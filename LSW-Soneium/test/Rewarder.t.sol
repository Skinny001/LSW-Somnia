// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {LSW} from "../src/LSW.sol";
import {Rewarder} from "../src/rewarder.sol";
import {MockRewarder} from "../src/mocks/MockRewarder.sol";
import {MockVRFV2PlusWrapper} from "../src/mocks/MockVRFV2PlusWrapper.sol";

contract RewarderTest is Test {
    LSW public lsw;
    MockRewarder public rewarder;
    MockVRFV2PlusWrapper public mockVRFWrapper;
    
    address public owner = address(this);
    address public treasury = address(0x1234);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);
    address public user4 = address(0x4);
    address public user5 = address(0x5);
    
    // Test configuration
    uint256 public constant STAKE_BUFFER = 300;
    uint256 public constant STAKE_AMOUNT = 0.1 ether;
    uint256 public constant ROUND_DURATION = 3600;
    uint256 public constant BUFFER_DELAY = 600;
    uint256 public constant STAKING_WAIT_PERIOD = 600;

    event RewardsDistributed(uint256 indexed roundId, address[] winners, uint256 rewardPerWinner, uint256 treasuryAmount);
    event RandomnessRequested(uint256 indexed roundId, uint256 requestId, uint256 paid);

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
        vm.deal(user5, 10 ether);
        
        // Give the test contract some ETH for calling rewarder functions
        vm.deal(address(this), 10 ether);
    }

    function testRewarderInitialState() public view {
        assertEq(rewarder.owner(), owner);
        assertEq(rewarder.lswContract(), address(lsw));
    }

    function testRewardDistributionWithNoParticipants() public {
        // This test checks that when there are no participants, treasury gets all funds
        uint256 treasuryBalanceBefore = treasury.balance;
        
        // Give LSW contract some ETH to send to rewarder
        vm.deal(address(lsw), 1 ether);
        
        // Mock calling rewardRandomParticipants with no participants (empty round)
        vm.prank(address(lsw));
        rewarder.rewardRandomParticipants{value: 0.5 ether}(0, 0.7 ether, 0.3 ether, 0.2 ether);
        
        assertEq(treasury.balance, treasuryBalanceBefore + 0.5 ether);
    }

    function testRewardDistributionWithFewParticipants() public {
        // Create a scenario with 3 participants
        address[] memory participants = new address[](3);
        participants[0] = user1;
        participants[1] = user2;
        participants[2] = user3;

         uint256 originalDeadline;
        {
            (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
            originalDeadline = deadline;
        }

        // Skip wait period and add some ETH to contract
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        _createRoundWithParticipants(participants);
        
        uint256 user1BalanceBefore = user1.balance;
        uint256 user2BalanceBefore = user2.balance;
        uint256 user3BalanceBefore = user3.balance;
        uint256 treasuryBalanceBefore = treasury.balance;
        
        uint256 participantAmount = 0.3 ether;
        uint256 treasuryAmount = 0.2 ether;
        uint256 rewardPerParticipant = participantAmount / 3;
        
        // Give LSW contract some ETH to send to rewarder
        vm.deal(address(lsw), 1 ether);
        
        // Mock calling rewardRandomParticipants
        vm.prank(address(lsw));
        rewarder.rewardRandomParticipants{value: participantAmount + treasuryAmount}(0, 0.7 ether, participantAmount, treasuryAmount);
        
        // Check all participants received rewards
        assertEq(user1.balance, user1BalanceBefore + rewardPerParticipant);
        assertEq(user2.balance, user2BalanceBefore + rewardPerParticipant);
        assertEq(user3.balance, user3BalanceBefore + rewardPerParticipant);
        assertEq(treasury.balance, treasuryBalanceBefore + treasuryAmount);
    }

    function testRewardDistributionWithManyParticipants() public {

         uint256 originalDeadline;
        {
            (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
            originalDeadline = deadline;
        }

        // Skip wait period and add some ETH to contract
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);


        // Create 15 participants
        address[] memory participants = new address[](15);
        for (uint i = 0; i < 15; i++) {
            participants[i] = address(uint160(0x1000 + i));
            vm.deal(participants[i], 10 ether);
            
            vm.prank(participants[i]);
            lsw.stake{value: STAKE_AMOUNT}();
        }
        
        uint256 participantAmount = 0.3 ether;
        uint256 treasuryAmount = 0.2 ether;
        
        // Get request price before pranking
        uint256 requestPrice = mockVRFWrapper.REQUEST_PRICE();
        
        // This should trigger VRF request
        vm.expectEmit(true, true, false, false);
        emit RandomnessRequested(0, 1, requestPrice); // Expect requestId 1 with request price
        
        vm.prank(address(lsw));
        rewarder.rewardRandomParticipants{value: participantAmount + treasuryAmount}(0, 0.7 ether, participantAmount, treasuryAmount);
        
        // Verify pending reward is created
        Rewarder.PendingReward memory pendingReward = rewarder.getPendingReward(1);
        assertEq(pendingReward.roundId, 0);
        assertEq(pendingReward.randomParticipantsAmount, participantAmount);
        assertEq(pendingReward.platformTreasuryAmount, treasuryAmount);
        assertFalse(pendingReward.fulfilled);
        
        // Generate mock random words and fulfill
        uint256[] memory randomWords = mockVRFWrapper.generateMockRandomWords(12345, 10);
        
        uint256 treasuryBalanceBefore = treasury.balance;
        
        // Fulfill the VRF request
        mockVRFWrapper.fulfillRandomWords(1, address(rewarder), randomWords);
        
        // Check that rewards were distributed
        assertEq(treasury.balance, treasuryBalanceBefore + treasuryAmount);
        
        // Check that the pending reward is marked as fulfilled
        Rewarder.PendingReward memory pendingRewardAfter = rewarder.getPendingReward(1);
        assertTrue(pendingRewardAfter.fulfilled);
    }

    function testManualDistribution() public {
        // Create participants
        address[] memory participants = new address[](2);
        participants[0] = user1;
        participants[1] = user2;

        uint256 originalDeadline;
        {
            (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
            originalDeadline = deadline;
        }

        // Skip wait period and add some ETH to contract
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        _createRoundWithParticipants(participants);
        
        // Add more participants to make it over the threshold (15+ participants)
        address[] memory manyParticipants = new address[](15);
        for (uint i = 0; i < 15; i++) {
            manyParticipants[i] = address(uint160(0x2000 + i));
            vm.deal(manyParticipants[i], 10 ether);
            vm.prank(manyParticipants[i]);
            lsw.stake{value: STAKE_AMOUNT}();
        }
        
        uint256 winnerAmount = 0.7 ether;
        uint256 participantAmount = 0.3 ether;
        uint256 treasuryAmount = 0.2 ether;
        uint256 totalAmount = winnerAmount + participantAmount + treasuryAmount;
        
        // Ensure LSW has enough ETH to send
        vm.deal(address(lsw), totalAmount);
        
        // Get balances before
        uint256 treasuryBalanceBefore = treasury.balance;
        uint256 user1BalanceBefore = user1.balance;
        uint256 user2BalanceBefore = user2.balance;
        
        // Call rewardRandomParticipants on current round (0) which will trigger VRF request
        vm.prank(address(lsw));
        rewarder.rewardRandomParticipants{value: totalAmount}(0, winnerAmount, participantAmount, treasuryAmount);
        
        // Since we have 17 participants (15 new + 2 original), this should trigger VRF
        // But we'll simulate VRF failure by calling manual distribution
        rewarder.manualDistribution(0);
        
        // In manual distribution, all participants get equal share of participantAmount
        // plus treasury gets treasuryAmount
        uint256 expectedRewardPerParticipant = participantAmount / 17; // 17 total participants
        
        // Check that participants got their rewards
        assertEq(user1.balance, user1BalanceBefore + expectedRewardPerParticipant);
        assertEq(user2.balance, user2BalanceBefore + expectedRewardPerParticipant);
        
        // Check that treasury got its share
        assertEq(treasury.balance, treasuryBalanceBefore + treasuryAmount);
    }

    function testRewarderOnlyFunctions() public {
        // Test that only LSW can call rewardRandomParticipants
        vm.prank(user1);
        vm.expectRevert(Rewarder.NotLSW.selector);
        rewarder.rewardRandomParticipants{value: 1 ether}(0, 0.7 ether, 0.2 ether, 0.1 ether);
        
        // Test that only owner can call owner functions
        vm.prank(user1);
        vm.expectRevert(Rewarder.NotOwner.selector);
        rewarder.updateLSWContract(address(0x1234));
        
        vm.prank(user1);
        vm.expectRevert(Rewarder.NotOwner.selector);
        rewarder.manualDistribution(0);
        
        vm.prank(user1);
        vm.expectRevert(Rewarder.NotOwner.selector);
        rewarder.emergencyWithdraw();
    }

    function testUpdateFunctions() public {
        // Test updateLSWContract
        address newLSW = address(0x5678);
        rewarder.updateLSWContract(newLSW);
        assertEq(rewarder.lswContract(), newLSW);
    }

    function testZeroAddressValidation() public {
        vm.expectRevert(Rewarder.ZeroAddress.selector);
        rewarder.updateLSWContract(address(0));
    }

    function testEmergencyWithdraw() public {
        // Send some ETH to rewarder
        vm.deal(address(rewarder), 1 ether);
        
        uint256 ownerBalanceBefore = owner.balance;
        uint256 contractBalance = address(rewarder).balance;
        
        rewarder.emergencyWithdraw();
        
        assertEq(owner.balance, ownerBalanceBefore + contractBalance);
        assertEq(address(rewarder).balance, 0);
    }

    function testDoubleRewardFulfillment() public {
         uint256 originalDeadline;
        {
            (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
            originalDeadline = deadline;
        }

        // Skip wait period and add some ETH to contract
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);

        // Create participants
        for (uint i = 0; i < 15; i++) {
            address participant = address(uint160(0x1000 + i));
            vm.deal(participant, 10 ether);
            vm.prank(participant);
            lsw.stake{value: STAKE_AMOUNT}();
        }
        
        // Create VRF request
        vm.prank(address(lsw));
        rewarder.rewardRandomParticipants{value: 0.5 ether}(0, 0.7 ether, 0.3 ether, 0.2 ether);
        
        // Fulfill once
        uint256[] memory randomWords = mockVRFWrapper.generateMockRandomWords(12345, 10);
        mockVRFWrapper.fulfillRandomWords(1, address(rewarder), randomWords);
        
        // Try to fulfill again - should revert
        vm.expectRevert(Rewarder.RewardAlreadyFulfilled.selector);
        rewarder.testFulfillRandomWords(1, randomWords);
    }

    // Custom event for testing
    event VRFConfigUpdated(address coordinator, bytes32 keyHash, uint64 subId);
    
    // Helper function to create a round with participants
    function _createRoundWithParticipants(address[] memory participants) internal {
        for (uint i = 0; i < participants.length; i++) {
            vm.prank(participants[i]);
            lsw.stake{value: STAKE_AMOUNT}();
        }
    }
    
    // Receive function to accept ETH transfers
    receive() external payable {}
}
