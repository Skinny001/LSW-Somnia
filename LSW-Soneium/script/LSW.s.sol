// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {LSW} from "../src/LSW.sol";
import {Rewarder} from "../src/rewarder.sol";

contract LSWScript is Script {
    // Deployment configuration -
    uint256 public constant STAKE_BUFFER = 300; // 5 minutes in seconds
    uint256 public constant STAKE_AMOUNT = 0.01 ether; // Minimum stake amount
    uint256 public constant ROUND_DURATION = 3600; // 1 hour in seconds
    uint256 public constant BUFFER_DELAY = 600; // 10 minutes in seconds
    uint256 public constant STAKING_WAIT_PERIOD = 180; // 3 minutes in seconds
    
    // VRF Configuration - VRFV2PlusWrapper for native payment (Sonmi testnet)
    address public constant VRF_WRAPPER = 0x763cC914d5CA79B04dC4787aC14CcAd780a16BD2; // Sonmi testnet VRF Wrapper
    
    // Treasury address 
    address public constant TREASURY = 0x12896191de42EF8388f2892Ab76b9a728189260A; 

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy LSW contract
        LSW.ConstructorParams memory params = LSW.ConstructorParams({
            stakeBuffer: STAKE_BUFFER,
            stakeAmount: STAKE_AMOUNT,
            roundDuration: ROUND_DURATION,
            bufferDelay: BUFFER_DELAY,
            stakingWaitPeriod: STAKING_WAIT_PERIOD,
            treasury: TREASURY
        });
        
        LSW lsw = new LSW(params);
        console.log("LSW deployed at:", address(lsw));

        // Deploy Rewarder contract with VRF Wrapper (native payment)
        Rewarder rewarder = new Rewarder(
            address(lsw),
            VRF_WRAPPER
        );
        console.log("Rewarder deployed at:", address(rewarder));

        // Set rewarder in LSW contract
        lsw.setRewarderContract(address(rewarder));
        console.log("Rewarder contract set in LSW");

        vm.stopBroadcast();

        // Log deployment information
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("LSW Contract:", address(lsw));
        console.log("Rewarder Contract:", address(rewarder));
        console.log("Treasury:", TREASURY);
        console.log("Stake Amount:", STAKE_AMOUNT);
        console.log("Round Duration:", ROUND_DURATION, "seconds");
        console.log("Stake Buffer:", STAKE_BUFFER, "seconds");
        console.log("Buffer Delay:", BUFFER_DELAY, "seconds");
        console.log("Staking Wait Period:", STAKING_WAIT_PERIOD, "seconds");
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Fund the Rewarder contract with native tokens for VRF payments");
        console.log("2. Call getRequestPrice() on Rewarder to see how much native token is needed per VRF request");
        console.log("3. Update the TREASURY address in the deployment script if needed");
        console.log("4. Verify contracts on block explorer");
    }

    // Alternative deployment function for testnets with mock VRF
    function deployWithMockVRF() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with Mock VRF for testing...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Mock VRF Wrapper (for testing purposes)
        MockVRFV2PlusWrapper mockVRFWrapper = new MockVRFV2PlusWrapper();
        console.log("Mock VRF Wrapper deployed at:", address(mockVRFWrapper));

        // Deploy LSW contract
        LSW.ConstructorParams memory params = LSW.ConstructorParams({
            stakeBuffer: STAKE_BUFFER,
            stakeAmount: STAKE_AMOUNT,
            roundDuration: ROUND_DURATION,
            bufferDelay: BUFFER_DELAY,
            stakingWaitPeriod: STAKING_WAIT_PERIOD,
            treasury: TREASURY
        });
        
        LSW lsw = new LSW(params);
        console.log("LSW deployed at:", address(lsw));

        // Deploy Rewarder with mock VRF wrapper
        MockRewarder rewarder = new MockRewarder(
            address(lsw),
            address(mockVRFWrapper)
        );
        console.log("Mock Rewarder deployed at:", address(rewarder));

        // Set rewarder in LSW contract
        lsw.setRewarderContract(address(rewarder));
        console.log("Mock Rewarder contract set in LSW");

        // Fund rewarder for VRF payments
        (bool success, ) = address(rewarder).call{value: 1 ether}("");
        require(success, "Failed to fund rewarder");
        console.log("Funded rewarder with 1 ETH for VRF payments");

        vm.stopBroadcast();

        console.log("\n=== MOCK DEPLOYMENT SUMMARY ===");
        console.log("LSW Contract:", address(lsw));
        console.log("Mock Rewarder Contract:", address(rewarder));
        console.log("Mock VRF Wrapper:", address(mockVRFWrapper));
        console.log("Note: This deployment uses mock contracts for testing only!");
    }
}

// Import mock contracts for alternative deployment
import {MockRewarder} from "../src/mocks/MockRewarder.sol";
import {MockVRFV2PlusWrapper} from "../src/mocks/MockVRFV2PlusWrapper.sol";
