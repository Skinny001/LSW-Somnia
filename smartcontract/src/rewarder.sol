// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.19;

// Last Staker Win Contract: Rewarder Contract
// written by 0xblackadam

import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

interface ILSW {
    function closeRound(uint256 roundId) external;
    function getRoundStakers(uint256 roundId) external view returns (address[] memory);
    function treasury() external view returns (address);
}

interface IVRFV2PlusWrapper {
    function requestRandomWordsInNative(
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords,
        bytes memory extraArgs
    ) external payable returns (uint256);
    
    function calculateRequestPrice(
        uint32 callbackGasLimit,
        uint32 numWords
    ) external view returns (uint256);
}

contract Rewarder {
    address public owner;
    address public lswContract;
    address public vrfWrapperAddress;
    
    // VRF Configuration
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant CALLBACK_GAS_LIMIT = 2_100_000;
    uint32 public constant NUM_WORDS = 10;
    
    // Pending reward distributions
    struct PendingReward {
        uint256 roundId;
        uint256 randomParticipantsAmount;
        uint256 platformTreasuryAmount;
        bool fulfilled;
    }
    
    mapping(uint256 => PendingReward) public pendingRewards;
    mapping(uint256 => uint256) public roundToRequestId;

    // Events
    event RandomnessRequested(uint256 indexed roundId, uint256 requestId, uint256 paid);
    event RewardsDistributed(uint256 indexed roundId, address[] winners, uint256 rewardPerWinner, uint256 treasuryAmount);

    error NotOwner();
    error NotLSW();
    error ZeroAddress();
    error InsufficientParticipants();
    error TransferFailed();
    error RewardAlreadyFulfilled();
    error InsufficientPayment(uint256 required, uint256 sent);

    constructor(
        address _lswContract,
        address _vrfWrapperAddress
    ) {
        if (_lswContract == address(0) || _vrfWrapperAddress == address(0)) revert ZeroAddress();
        
        owner = msg.sender;
        lswContract = _lswContract;
        vrfWrapperAddress = _vrfWrapperAddress;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyLSW() {
        if (msg.sender != lswContract) revert NotLSW();
        _;
    }

    function updateLSWContract(address _lswContract) external onlyOwner {
        if (_lswContract == address(0)) revert ZeroAddress();
        lswContract = _lswContract;
    }

    function updateVRFWrapperAddress(address _vrfWrapperAddress) external onlyOwner {
        if (_vrfWrapperAddress == address(0)) revert ZeroAddress();
        vrfWrapperAddress = _vrfWrapperAddress;
    }

    // Function to reward random 10 stakers from the round participants
    function rewardRandomParticipants(
        uint256 roundId, 
        uint256 winnerAmount,
        uint256 randomParticipantsAmount, 
        uint256 platformTreasuryAmount
    ) external payable onlyLSW {
        
        // Get all stakers for this round
        address[] memory stakers = ILSW(lswContract).getRoundStakers(roundId);
        
        if (stakers.length == 0) {
            // No participants, send everything to treasury
            address treasury = ILSW(lswContract).treasury();
            (bool success, ) = payable(treasury).call{value: msg.value}("");
            if (!success) revert TransferFailed();
            
            return;
        }
        
        if (stakers.length <= 10) {
            // Less than or equal to 10 participants, distribute equally among all
            _distributeToAllParticipants(roundId, stakers, randomParticipantsAmount, platformTreasuryAmount);
        } else {
            // More than 10 participants, use VRF to select random 10
            _requestRandomParticipants(roundId, randomParticipantsAmount, platformTreasuryAmount);
        }
    }

    function _distributeToAllParticipants(
        uint256 roundId,
        address[] memory participants,
        uint256 participantAmount,
        uint256 treasuryAmount
    ) private {
        uint256 rewardPerParticipant = participantAmount / participants.length;
        
        // Distribute to all participants
        for (uint i = 0; i < participants.length; i++) {
            (bool participantSuccess, ) = payable(participants[i]).call{value: rewardPerParticipant}("");
            if (!participantSuccess) revert TransferFailed();
        }
        
        // Send treasury amount
        address treasury = ILSW(lswContract).treasury();
        (bool treasurySuccess, ) = payable(treasury).call{value: treasuryAmount}("");
        if (!treasurySuccess) revert TransferFailed();
        
        emit RewardsDistributed(roundId, participants, rewardPerParticipant, treasuryAmount);
    }

    function _requestRandomParticipants(
        uint256 roundId,
        uint256 participantAmount,
        uint256 treasuryAmount
    ) private {
            // Request randomness from the VRF wrapper
            IVRFV2PlusWrapper wrapper = IVRFV2PlusWrapper(vrfWrapperAddress);
            
            uint256 vrfCost = getRequestPrice();
            
            if (address(this).balance < vrfCost) {
                revert InsufficientPayment(vrfCost, address(this).balance);
            }

            // Encode extraArgs: tag (4 bytes) + ExtraArgsV1 struct (32 bytes) = 36 bytes
            // Use the proper VRFV2PlusClient tag
            bytes memory args = abi.encodePacked(
                VRFV2PlusClient.EXTRA_ARGS_V1_TAG,
                abi.encode(VRFV2PlusClient.ExtraArgsV1({nativePayment: true}))
            );
            
            // Request randomness with the calculated cost
            uint256 requestId = wrapper.requestRandomWordsInNative{value: vrfCost}(
                CALLBACK_GAS_LIMIT,
                REQUEST_CONFIRMATIONS,
                NUM_WORDS,
                args
            );
            
            // Store pending reward info
            pendingRewards[requestId] = PendingReward({
                roundId: roundId,
                randomParticipantsAmount: participantAmount,
                platformTreasuryAmount: treasuryAmount,
                fulfilled: false
            });
            
            roundToRequestId[roundId] = requestId;
            
            emit RandomnessRequested(roundId, requestId, vrfCost);
    }

    // Callback function called by VRF Wrapper
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        // Only VRF wrapper can call this
        require(msg.sender == vrfWrapperAddress, "Only VRF wrapper can call");
        fulfillRandomWords(requestId, randomWords);
    }

    // Internal function to handle the random words
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal {
        PendingReward storage reward = pendingRewards[requestId];
        
        if (reward.fulfilled) revert RewardAlreadyFulfilled();
        
        // Get all stakers for this round
        address[] memory allStakers = ILSW(lswContract).getRoundStakers(reward.roundId);
        
        if (allStakers.length == 0) {
            reward.fulfilled = true;
            return;
        }
        
        // Select random participants (duplicates allowed - increases chances for multi-stakers)
        address[] memory selectedParticipants = _selectRandomParticipants(allStakers, randomWords);
        
        uint256 rewardPerParticipant = reward.randomParticipantsAmount / 10;
        
        // Distribute rewards to selected participants
        for (uint i = 0; i < 10; i++) {
            (bool _success, ) = payable(selectedParticipants[i]).call{value: rewardPerParticipant}("");
            if (!_success) revert TransferFailed();
        }
        
        // Send treasury amount
        address treasury = ILSW(lswContract).treasury();
        (bool success, ) = payable(treasury).call{value: reward.platformTreasuryAmount}("");
        if (!success) revert TransferFailed();
        
        reward.fulfilled = true;
        
        emit RewardsDistributed(reward.roundId, selectedParticipants, rewardPerParticipant, reward.platformTreasuryAmount);
    }

    function _selectRandomParticipants(
        address[] memory allStakers,
        uint256[] memory randomWords
    ) private pure returns (address[] memory) {
        address[] memory selected = new address[](10);
        
        // Simply select participants based on random indices - duplicates are allowed
        for (uint256 i = 0; i < 10; i++) {
            uint256 randomIndex = randomWords[i % randomWords.length] % allStakers.length;
            selected[i] = allStakers[randomIndex];
        }
        
        return selected;
    }

    // Manual fallback for failed VRF requests
    function manualDistribution(uint256 roundId) external onlyOwner {
        uint256 requestId = roundToRequestId[roundId];
        PendingReward storage reward = pendingRewards[requestId];
        
        if (reward.fulfilled) revert RewardAlreadyFulfilled();
        
        address[] memory allStakers = ILSW(lswContract).getRoundStakers(roundId);
        
        if (allStakers.length == 0) {
            address treasury = ILSW(lswContract).treasury();
            (bool success, ) = payable(treasury).call{value: reward.randomParticipantsAmount + reward.platformTreasuryAmount}("");
            if (!success) revert TransferFailed();
        } else {
            _distributeToAllParticipants(roundId, allStakers, reward.randomParticipantsAmount, reward.platformTreasuryAmount);
        }
        
        reward.fulfilled = true;
    }

    // View functions
    function getPendingReward(uint256 requestId) external view returns (PendingReward memory) {
        return pendingRewards[requestId];
    }

    /**
     * @notice Get the current price for a VRF request in native tokens
     * @return The price in wei for requesting random numbers
     */
    function getRequestPrice() public view returns (uint256) {
        IVRFV2PlusWrapper wrapper = IVRFV2PlusWrapper(vrfWrapperAddress);
        return wrapper.calculateRequestPrice(CALLBACK_GAS_LIMIT, NUM_WORDS);
    }

    // Emergency withdrawal
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner).call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    // Allow contract to receive native tokens for VRF payment
    receive() external payable {}
}