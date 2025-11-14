// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {LSW} from "../src/LSW.sol";
import {Rewarder} from "../src/rewarder.sol";
import {MockRewarder} from "../src/mocks/MockRewarder.sol";
import {MockVRFV2PlusWrapper} from "../src/mocks/MockVRFV2PlusWrapper.sol";

contract IntegrationTest is Test {
    LSW public lsw;
    MockRewarder public rewarder;
    MockVRFV2PlusWrapper public mockVRFWrapper;
    
    address public owner = address(this);
    address public treasury = address(0x1234);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);
    address public user4 = address(0x4);
    
    // Test configuration
    uint256 public constant STAKE_BUFFER = 300;
    uint256 public constant STAKE_AMOUNT = 0.1 ether;
    uint256 public constant ROUND_DURATION = 3600;
    uint256 public constant BUFFER_DELAY = 600;
    uint256 public constant STAKING_WAIT_PERIOD = 600;

    function setUp() public {
        // Deploy mock VRF wrapper
        mockVRFWrapper = new MockVRFV2PlusWrapper();
        
        // Deploy LSW contract
        LSW.ConstructorParams memory params = LSW.ConstructorParams({
            stakeBuffer: STAKE_BUFFER,
            stakeAmount: STAKE_AMOUNT,
            roundDuration: ROUND_DURATION,
            bufferDelay: BUFFER_DELAY,
            stakingWaitPeriod: STAKING_WAIT_PERIOD,
            treasury: treasury
        });
        lsw = new LSW(params);
        
        // Deploy rewarder contract
        rewarder = new MockRewarder(
            address(lsw),
            address(mockVRFWrapper)
        );
        
        // Set rewarder in LSW contract
        lsw.setRewarderContract(address(rewarder));
        
        // Fund the rewarder contract for VRF payments
        vm.deal(address(rewarder), 10 ether);
        
        // Give test accounts some ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
        vm.deal(user4, 10 ether);
    }

    function testFullRoundWithFewParticipants() public {
        // Skip wait period first
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        address[] memory participants = new address[](5);
        
        // Setup participants
        for (uint i = 0; i < 5; i++) {
            participants[i] = address(uint160(0x1000 + i));
            vm.deal(participants[i], 10 ether);
        }
        
        // All participants stake
        for (uint i = 0; i < 5; i++) {
            vm.prank(participants[i]);
            lsw.stake{value: STAKE_AMOUNT}();
        }
        
        // Get round info
        (, address lastStaker, uint256 totalAmount, uint256 deadline, bool isActive, uint256 stakersCount,) = lsw.getCurrentRoundInfo();
        assertEq(stakersCount, 5);
        assertEq(totalAmount, STAKE_AMOUNT * 5);
        assertEq(lastStaker, participants[4]); // Last participant is the winner
        assertTrue(isActive);
        
        // Move past deadline to end round
        vm.warp(deadline + 1);
        
        // Anyone can trigger round end by attempting to stake (which will now revert)
        address triggerUser = address(0x9999);
        vm.deal(triggerUser, 1 ether);
        vm.prank(triggerUser);
        vm.expectRevert(LSW.RoundExpired.selector);
        lsw.stake{value: STAKE_AMOUNT}();
        
        uint256 winnerBalanceBefore = lastStaker.balance;
        uint256 treasuryBalanceBefore = treasury.balance;
        
        // Winner starts new round - this should distribute rewards automatically
        vm.prank(lastStaker);
        lsw.startNewRound();
        
        // Check that new round started
        assertEq(lsw.roundId(), 1);
        
        // Check reward distribution (70% to winner, 20% distributed among participants, 10% treasury)
        uint256 expectedWinnerReward = (totalAmount * 70) / 100;
        uint256 participantRewardPerPerson = (totalAmount * 20) / 100 / 5; // 20% split among 5 participants
        uint256 expectedWinnerTotal = expectedWinnerReward + participantRewardPerPerson; // Winner also gets participant reward
        assertEq(lastStaker.balance, winnerBalanceBefore + expectedWinnerTotal);
        
        // Check participant rewards - simplified to avoid stack too deep
        // Note: The winner gets both winner reward (70%) and participant reward (their share of 20%)
        for (uint i = 0; i < 5; i++) {
            // Each participant should have: initial(10e) - stake(0.1e) + participant_reward(0.02e)
            // Winner additionally gets winner reward (0.35e)
            if (participants[i] == lastStaker) {
                // Winner gets both winner and participant rewards
                assertEq(participants[i].balance, 10.27 ether); // Exact calculation: 10 - 0.1 + 0.35 + 0.02
            } else {
                // Regular participants get only participant reward
                assertEq(participants[i].balance, 9.92 ether); // Exact calculation: 10 - 0.1 + 0.02
            }
        }
        
        // Treasury should receive 10%
        uint256 expectedTreasuryAmount = (totalAmount * 10) / 100;
        assertEq(treasury.balance, treasuryBalanceBefore + expectedTreasuryAmount);
    }

    function testFullRoundWithManyParticipants() public {
        // Skip wait period first
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        uint256 numParticipants = 20;
        address[] memory participants = new address[](numParticipants);
        
        // Setup participants
        for (uint i = 0; i < numParticipants; i++) {
            participants[i] = address(uint160(0x1000 + i));
            vm.deal(participants[i], 10 ether);
        }
        
        // All participants stake
        for (uint i = 0; i < numParticipants; i++) {
            vm.prank(participants[i]);
            lsw.stake{value: STAKE_AMOUNT}();
        }
        
        // Get round info
        (, address lastStaker, uint256 totalAmount, uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
        
        // Move past deadline to end round
        vm.warp(deadline + 1);
        
        // Trigger round end by attempting to stake (will revert)
        address triggerUser = address(0x9999);
        vm.deal(triggerUser, 1 ether);
        vm.prank(triggerUser);
        vm.expectRevert(LSW.RoundExpired.selector);
        lsw.stake{value: STAKE_AMOUNT}();
        
        uint256 winnerBalanceBefore = lastStaker.balance;
        uint256 treasuryBalanceBefore = treasury.balance;
        
        // Winner starts new round - this should trigger VRF request
        vm.prank(lastStaker);
        lsw.startNewRound();
        
        // Check winner got their reward immediately
        uint256 expectedWinnerReward = (totalAmount * 70) / 100;
        assertEq(lastStaker.balance, winnerBalanceBefore + expectedWinnerReward);
        
        // Check that VRF was requested (request ID should be 1)
        Rewarder.PendingReward memory pendingReward = rewarder.getPendingReward(1);
        assertEq(pendingReward.roundId, 0);
        assertFalse(pendingReward.fulfilled);
        
        // Simulate VRF fulfillment
        uint256[] memory randomWords = mockVRFWrapper.generateMockRandomWords(12345, 10);
        mockVRFWrapper.fulfillRandomWords(1, address(rewarder), randomWords);
        
        // Check that rewards were distributed
        Rewarder.PendingReward memory pendingRewardAfter = rewarder.getPendingReward(1);
        assertTrue(pendingRewardAfter.fulfilled);
        
        // Treasury should have received its share
        uint256 expectedTreasuryAmount = (totalAmount * 10) / 100;
        assertEq(treasury.balance, treasuryBalanceBefore + expectedTreasuryAmount);
    }

    function testMultipleRounds() public {
        // Skip wait period first
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        // Round 1
        address winner1 = address(0x1001);
        vm.deal(winner1, 10 ether);
        vm.prank(winner1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // End round 1
        (, , , uint256 deadline1, , ,) = lsw.getCurrentRoundInfo();
        vm.warp(deadline1 + 1);
        
        address triggerUser = address(0x9999);
        vm.deal(triggerUser, 1 ether);
        vm.prank(triggerUser);
        vm.expectRevert(LSW.RoundExpired.selector);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // Start new round
        vm.prank(winner1);
        lsw.startNewRound();
        
        assertEq(lsw.roundId(), 1);
        
        // Skip wait period for round 2
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        // Round 2
        address winner2 = address(0x1002);
        vm.deal(winner2, 10 ether);
        vm.prank(winner2);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // End round 2
        (, , , uint256 deadline2, , ,) = lsw.getCurrentRoundInfo();
        vm.warp(deadline2 + 1);
        
        vm.prank(triggerUser);
        vm.expectRevert(LSW.RoundExpired.selector);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // Start new round
        vm.prank(winner2);
        lsw.startNewRound();
        
        assertEq(lsw.roundId(), 2);
    }

    function testOnlyRewarderCanCloseRound() public {
        // Skip wait period first
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        // Start a round and end it
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
        vm.warp(deadline + 1);
        
        // Try to call closeRound as owner (should fail)
        vm.prank(owner);
        vm.expectRevert(LSW.PermissionDenied.selector);
        lsw.closeRound(0);
    }

    function testRoundAlreadyClaimed() public {
        // Skip wait period first
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        // Start a round and end it
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
        vm.warp(deadline + 1);
        
        // Start new round (this marks the round as claimed and starts round 1)
        vm.prank(user1); // user1 is the winner
        lsw.startNewRound();
        
        // Try to start new round again - should fail because current round (1) is still active
        vm.expectRevert(LSW.RoundNotEnded.selector);
        lsw.startNewRound();
    }

    function testStartNewRoundPermissions() public {
        // Anyone can call startNewRound now (no permission checks)
        // This test verifies that a round that hasn't ended can't be started
        address randomUser = address(0x5555);
        vm.deal(randomUser, 1 ether);
        
        vm.prank(randomUser);
        vm.expectRevert(LSW.RoundNotEnded.selector);
        lsw.startNewRound();
    }

    function testStartNewRoundWithoutRewarder() public {
        // Deploy new LSW without rewarder
        LSW.ConstructorParams memory params = LSW.ConstructorParams({
            stakeBuffer: STAKE_BUFFER,
            stakeAmount: STAKE_AMOUNT,
            roundDuration: ROUND_DURATION,
            bufferDelay: BUFFER_DELAY,
            stakingWaitPeriod: STAKING_WAIT_PERIOD,
            treasury: treasury
        });
        LSW newLsw = new LSW(params);
        
        // Skip wait period and make a stake
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        vm.prank(user1);
        newLsw.stake{value: STAKE_AMOUNT}();
        
        // End the initial round
        (, , , uint256 deadline, , ,) = newLsw.getCurrentRoundInfo();
        vm.warp(deadline + 1);
        
        // Now try to start new round without rewarder set - should fail
        vm.expectRevert(LSW.RewarderNotSet.selector);
        newLsw.startNewRound();
    }
    
    // Receive function to accept ETH transfers
    receive() external payable {}
}
