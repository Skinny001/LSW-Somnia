// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {LSW} from "../src/LSW.sol";
import {MockRewarder} from "../src/mocks/MockRewarder.sol";
import {MockVRFV2PlusWrapper} from "../src/mocks/MockVRFV2PlusWrapper.sol";

contract LSWTest is Test {
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
    uint256 public constant STAKE_BUFFER = 300; // 5 minutes
    uint256 public constant STAKE_AMOUNT = 0.1 ether;
    uint256 public constant ROUND_DURATION = 3600; // 1 hour
    uint256 public constant BUFFER_DELAY = 600; // 10 minutes
    uint256 public constant STAKING_WAIT_PERIOD = 600; // 10 minutes

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

    function testInitialState() public view {
        assertEq(lsw.roundId(), 0);
        assertEq(lsw.owner(), owner);
        assertEq(lsw.rewarderContract(), address(rewarder));
        assertEq(lsw.treasury(), treasury);
        assertEq(lsw.stakeAmount(), STAKE_AMOUNT);
        assertEq(lsw.stakeBuffer(), STAKE_BUFFER);
        assertEq(lsw.roundDuration(), ROUND_DURATION);
        assertEq(lsw.bufferDelay(), BUFFER_DELAY);
        assertEq(lsw.stakingWaitPeriod(), STAKING_WAIT_PERIOD);
        
        (uint256 currentRoundId, address lastStaker, uint256 totalAmount, uint256 deadline, bool isActive, uint256 stakersCount, uint256 stakingAvailableAt) = lsw.getCurrentRoundInfo();
        assertEq(currentRoundId, 0);
        assertEq(lastStaker, address(0));
        assertEq(totalAmount, 0);
        assertTrue(deadline > block.timestamp);
        assertTrue(isActive);
        assertEq(stakersCount, 0);
        assertGt(stakingAvailableAt, block.timestamp);
    }

    function testStaking() public {
        // Skip the wait period
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        (, address lastStaker, uint256 totalAmount, , bool isActive, uint256 stakersCount,) = lsw.getCurrentRoundInfo();
        assertEq(lastStaker, user1);
        assertEq(totalAmount, STAKE_AMOUNT);
        assertTrue(isActive);
        assertEq(stakersCount, 1);
        
        address[] memory stakers = lsw.getRoundStakers(0);
        assertEq(stakers.length, 1);
        assertEq(stakers[0], user1);
    }

    function testStakingInsufficientAmount() public {
        // Skip the wait period
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        vm.prank(user1);
        vm.expectRevert(LSW.InsufficientStakeAmount.selector);
        lsw.stake{value: STAKE_AMOUNT - 1}();
    }

    function testMultipleStakes() public {
        // Skip the wait period
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        // User1 stakes
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // User2 stakes
        vm.prank(user2);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // User3 stakes
        vm.prank(user3);
        lsw.stake{value: STAKE_AMOUNT}();
        
        (, address lastStaker, uint256 totalAmount, , bool isActive, uint256 stakersCount,) = lsw.getCurrentRoundInfo();
        assertEq(lastStaker, user3);
        assertEq(totalAmount, STAKE_AMOUNT * 3);
        assertTrue(isActive);
        assertEq(stakersCount, 3);
        
        address[] memory stakers = lsw.getRoundStakers(0);
        assertEq(stakers.length, 3);
        assertEq(stakers[0], user1);
        assertEq(stakers[1], user2);
        assertEq(stakers[2], user3);
    }

    function testStakeExtension() public {
        // Move to near the end of round
        uint256 originalDeadline;
        {
            (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
            originalDeadline = deadline;
        }
        
        vm.warp(originalDeadline - BUFFER_DELAY + 1);
        
        // Stake should extend deadline
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        (, , , uint256 newDeadline, , ,) = lsw.getCurrentRoundInfo();
        assertGt(newDeadline, originalDeadline);
        assertEq(newDeadline, originalDeadline + STAKE_BUFFER);
    }

    function testRoundExpiration() public {
        // Skip the wait period first
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        // User1 stakes first
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // Move past deadline
        (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
        vm.warp(deadline + 1);
        
        // User2 tries to stake after deadline - should revert with RoundExpired
        vm.prank(user2);
        vm.expectRevert(LSW.RoundExpired.selector);
        lsw.stake{value: STAKE_AMOUNT}();
    }

    function testReceiveFunction() public {
        // Skip the wait period
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        // Send ETH directly to contract (should call stake())
        vm.prank(user1);
        (bool success,) = address(lsw).call{value: STAKE_AMOUNT}("");
        assertTrue(success);
        
        (, address lastStaker, uint256 totalAmount, , , ,) = lsw.getCurrentRoundInfo();
        assertEq(lastStaker, user1);
        assertEq(totalAmount, STAKE_AMOUNT);
    }

    function testOwnerFunctions() public {
        // Test setTreasury
        address newTreasury = address(0x5678);
        lsw.setTreasury(newTreasury);
        assertEq(lsw.treasury(), newTreasury);
        
        // Test updateStakeAmount
        uint256 newStakeAmount = 0.2 ether;
        lsw.updateStakeAmount(newStakeAmount);
        assertEq(lsw.stakeAmount(), newStakeAmount);
        
        // Test updateBufferSettings
        uint256 newStakeBuffer = 600;
        uint256 newBufferDelay = 300;
        lsw.updateBufferSettings(newStakeBuffer, newBufferDelay);
        assertEq(lsw.stakeBuffer(), newStakeBuffer);
        assertEq(lsw.bufferDelay(), newBufferDelay);
    }

    function testStakingWaitPeriod() public {
        // Try to stake immediately - should fail
        vm.prank(user1);
        vm.expectRevert(LSW.StakingNotYetAvailable.selector);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // Check time until staking is available
        uint256 timeUntilAvailable = lsw.getTimeUntilStakingAvailable();
        assertGt(timeUntilAvailable, 0);
        assertEq(timeUntilAvailable, STAKING_WAIT_PERIOD);
        
        // Check staking is not available
        assertFalse(lsw.isStakingAvailable());
        
        // Move to just before wait period ends
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD - 1);
        vm.prank(user1);
        vm.expectRevert(LSW.StakingNotYetAvailable.selector);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // Move past wait period
        vm.warp(block.timestamp + 2);
        
        // Now staking should be available
        assertTrue(lsw.isStakingAvailable());
        assertEq(lsw.getTimeUntilStakingAvailable(), 0);
        
        // Should be able to stake now
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        (, address lastStaker, uint256 totalAmount, , ,uint256 stakersCount,) = lsw.getCurrentRoundInfo();
        assertEq(lastStaker, user1);
        assertEq(totalAmount, STAKE_AMOUNT);
        assertEq(stakersCount, 1);
    }

    function testUpdateStakingWaitPeriod() public {
        uint256 newWaitPeriod = 1200; // 20 minutes
        lsw.updateStakingWaitPeriod(newWaitPeriod);
        assertEq(lsw.stakingWaitPeriod(), newWaitPeriod);
        
        // Test non-owner cannot update
        vm.prank(user1);
        vm.expectRevert(LSW.PermissionDenied.selector);
        lsw.updateStakingWaitPeriod(300);
    }

    function testStakingWaitPeriodAfterNewRound() public {
        // Skip initial wait period and make a stake
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // Move past deadline to end round
        (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
        vm.warp(deadline + 1);
        
        // End the round by attempting to stake (which will revert due to expiry)
        vm.prank(user2);
        vm.expectRevert(LSW.RoundExpired.selector);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // Start new round
        vm.prank(user1); // Winner starts new round
        lsw.startNewRound();
        
        // Should be in wait period for new round
        assertFalse(lsw.isStakingAvailable());
        assertGt(lsw.getTimeUntilStakingAvailable(), 0);
        
        // Try to stake immediately after new round - should fail
        vm.prank(user2);
        vm.expectRevert(LSW.StakingNotYetAvailable.selector);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // Skip wait period for new round
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        // Now should be able to stake
        vm.prank(user2);
        lsw.stake{value: STAKE_AMOUNT}();
        
        assertEq(lsw.roundId(), 1);
    }

    function testOwnerOnlyFunctions() public {
        vm.prank(user1);
        vm.expectRevert(LSW.PermissionDenied.selector);
        lsw.setTreasury(address(0x5678));
        
        vm.prank(user1);
        vm.expectRevert(LSW.PermissionDenied.selector);
        lsw.updateStakeAmount(0.2 ether);
        
        vm.prank(user1);
        vm.expectRevert(LSW.PermissionDenied.selector);
        lsw.updateBufferSettings(600, 300);
        
        vm.prank(user1);
        vm.expectRevert(LSW.PermissionDenied.selector);
        lsw.emergencyWithdraw();
    }

    function testZeroAddressValidation() public {
        vm.expectRevert(LSW.ZeroAddress.selector);
        lsw.setTreasury(address(0));
        
        vm.expectRevert(LSW.ZeroAddress.selector);
        lsw.setRewarderContract(address(0));
    }

    function testEmergencyWithdraw() public {
        // Skip wait period and add some ETH to contract
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        uint256 ownerBalanceBefore = owner.balance;
        uint256 contractBalance = address(lsw).balance;
        
        lsw.emergencyWithdraw();
        
        assertEq(owner.balance, ownerBalanceBefore + contractBalance);
        assertEq(address(lsw).balance, 0);
    }

    function testGetTimeRemaining() public {
        uint256 timeRemaining = lsw.getTimeRemaining();
        assertGt(timeRemaining, 0);
        
        // Move past deadline
        (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
        vm.warp(deadline + 1);
        
        timeRemaining = lsw.getTimeRemaining();
        assertEq(timeRemaining, 0);
    }

    function testCompleteRoundFlow() public {
        // Skip wait period first
        vm.warp(block.timestamp + STAKING_WAIT_PERIOD + 1);
        
        // Multiple users stake
        vm.prank(user1);
        lsw.stake{value: STAKE_AMOUNT}();
        
        vm.prank(user2);
        lsw.stake{value: STAKE_AMOUNT}();
        
        vm.prank(user3);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // user3 is the last staker, so they should be the winner
        (, , , uint256 deadline, , ,) = lsw.getCurrentRoundInfo();
        
        // Move past deadline to end the round
        vm.warp(deadline + 1);
        
        // Try to stake to trigger round end - should revert with RoundExpired
        vm.prank(user4);
        vm.expectRevert(LSW.RoundExpired.selector);
        lsw.stake{value: STAKE_AMOUNT}();
        
        // Now test starting a new round (winner can do this)
        vm.prank(user3); // user3 is the winner
        lsw.startNewRound(); // Should succeed now
        
        // Check new round started
        assertEq(lsw.roundId(), 1);
    }
    
    // Receive function to accept ETH transfers
    receive() external payable {}
}
