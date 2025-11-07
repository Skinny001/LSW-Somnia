// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.19;

// Last Staker Win Contract
// written by 0xblackadam

interface IRewarder {
    function rewardRandomParticipants(uint256 roundId, uint256 winnerAmount, uint256 randomParticipantsAmount, uint256 platformTreasuryAmount) payable external;
}

contract LSW {
    uint256 public roundId;
    address public owner;
    address public rewarderContract;
    address public treasury;

    struct ConstructorParams {
        uint256 stakeBuffer;
        uint256 stakeAmount;
        uint256 roundDuration;
        uint256 bufferDelay;
        uint256 stakingWaitPeriod;
        address treasury;
    }

    uint256 public stakeBuffer;
    uint256 public stakeAmount;
    uint256 public roundDuration;
    uint256 public bufferDelay;
    uint256 public stakingWaitPeriod; // Wait period before staking can begin
    uint256 public stakingStartTime; // When staking becomes available for current round

    struct Stake {
        address winner;
        uint256 amount;
        uint256 deadline;
        uint256 roundId;
        address lastStaker;
        bool isActive;
        bool claimed;
    }

    mapping(uint256 => Stake) public stakes;   
    mapping(uint256 => address[]) public roundStakers;

    // Events
    event RoundStarted(uint256 indexed roundId, uint256 indexed deadline, uint256 indexed _stakingStartTime);
    event StakeReceived(uint256 indexed roundId, address indexed staker, uint256 amount, uint256 newDeadline);
    event RoundEnded(uint256 indexed roundId, address indexed winner, uint256 totalAmount);
    event RewardsDistributed(uint256 indexed roundId, address indexed winner, uint256 winnerAmount, uint256 participantAmount, uint256 treasuryAmount);

    constructor(ConstructorParams memory params) {
        stakeBuffer = params.stakeBuffer;
        stakeAmount = params.stakeAmount;
        roundDuration = params.roundDuration;
        bufferDelay = params.bufferDelay;
        stakingWaitPeriod = params.stakingWaitPeriod;
        treasury = params.treasury;
        owner = msg.sender;
        
        // Initialize the first round
        _initializeRound();
    }

    // ================ Errors ================ //
    error InsufficientStakeAmount();
    error InvalidRoundId();
    error PermissionDenied();
    error RoundNotEnded();
    error RoundAlreadyClaimed();
    error ZeroAddress();
    error RewarderNotSet();
    error TransferFailed();
    error RoundExpired();
    error StakingNotYetAvailable();

    modifier onlyOwner() {
        if (msg.sender != owner) revert PermissionDenied();
        _;
    }

    modifier onlyRewarder() {
        if (msg.sender != rewarderContract) revert PermissionDenied();
        _;
    }

    function _initializeRound() private {
        stakingStartTime = block.timestamp + stakingWaitPeriod;
        
        stakes[roundId] = Stake({
            winner: address(0),
            amount: 0,
            deadline: block.timestamp + roundDuration,
            roundId: roundId,
            lastStaker: address(0),
            isActive: true,
            claimed: false
        });
        
        emit RoundStarted(roundId, stakes[roundId].deadline, stakingStartTime);
    }

    function startNewRound() public {
        Stake storage currentStake = stakes[roundId];
        
        // Check if current round has ended
        if (block.timestamp >= currentStake.deadline) {
            // End the round if it has expired
            if (currentStake.isActive) {
                currentStake.isActive = false;
                currentStake.winner = currentStake.lastStaker;
                emit RoundEnded(roundId, currentStake.winner, currentStake.amount);
            }
        } else {
            revert RoundNotEnded();
        }

        // Check if round has already been claimed (rewards distributed)
        if (currentStake.claimed) {
            revert RoundAlreadyClaimed();
        }

        if (rewarderContract == address(0)) {
            revert RewarderNotSet();
        }

        // Mark round as claimed first to prevent reentrancy
        currentStake.claimed = true;

        // Distribute rewards only if there's a winner and amount to distribute
        if (currentStake.winner != address(0) && currentStake.amount > 0) {
            _distributeRewards(roundId);
        }

        // Start new round
        roundId++;
        _initializeRound();
    }

    function _distributeRewards(uint256 _roundId) private {
        Stake storage stakeData = stakes[_roundId];
        uint256 totalAmount = stakeData.amount;

        // Calculate distribution amounts
        uint256 winnerAmount = (totalAmount * 70) / 100;
        uint256 randomParticipantsAmount = (totalAmount * 20) / 100;
        uint256 platformTreasuryAmount = (totalAmount * 10) / 100;

        // Transfer winner's amount
        (bool success, ) = payable(stakeData.winner).call{value: winnerAmount}("");
        if (!success) revert TransferFailed();

        // Call rewarder contract for random participant distribution
        IRewarder(rewarderContract).rewardRandomParticipants{value: randomParticipantsAmount + platformTreasuryAmount}(
            _roundId, 
            winnerAmount, 
            randomParticipantsAmount, 
            platformTreasuryAmount
        );

        emit RewardsDistributed(_roundId, stakeData.winner, winnerAmount, randomParticipantsAmount, platformTreasuryAmount);
    }

    function stake() public payable {
        if (msg.value < stakeAmount) {
            revert InsufficientStakeAmount();
        }
        
        Stake storage currentStake = stakes[roundId];

        if (!currentStake.isActive) {
            revert InvalidRoundId();
        }

        // Check if staking wait period has passed
        if (block.timestamp < stakingStartTime) {
            revert StakingNotYetAvailable();
        }

        // Check if round has expired - reject stake instead of refunding
        if (block.timestamp >= currentStake.deadline) {
            revert RoundExpired();
        }

        // Update stake info
        currentStake.lastStaker = msg.sender;
        currentStake.amount += msg.value;
        roundStakers[roundId].push(msg.sender);

        // Extend deadline if within buffer period
        if (currentStake.deadline - block.timestamp < bufferDelay) {
            currentStake.deadline += stakeBuffer;
        }

        emit StakeReceived(roundId, msg.sender, msg.value, currentStake.deadline);
    }

    function closeRound(uint256 _roundId) external view onlyRewarder {
        // This is called by the rewarder after rewards are distributed
        // Round should already be marked as claimed by startNewRound
        // This is mainly for bookkeeping and to emit events if needed
        Stake storage stakeData = stakes[_roundId];
        require(stakeData.claimed, "Round not in distribution phase");
    }

    function setRewarderContract(address _rewarderContract) external onlyOwner {
        if (_rewarderContract == address(0)) revert ZeroAddress();
        rewarderContract = _rewarderContract;
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function updateStakeAmount(uint256 _stakeAmount) external onlyOwner {
        stakeAmount = _stakeAmount;
    }

    function updateBufferSettings(uint256 _stakeBuffer, uint256 _bufferDelay) external onlyOwner {
        stakeBuffer = _stakeBuffer;
        bufferDelay = _bufferDelay;
    }

    function updateStakingWaitPeriod(uint256 _stakingWaitPeriod) external onlyOwner {
        stakingWaitPeriod = _stakingWaitPeriod;
    }

    // View functions
    function getCurrentRoundInfo() external view returns (
        uint256 currentRoundId,
        address lastStaker,
        uint256 totalAmount,
        uint256 deadline,
        bool isActive,
        uint256 stakersCount,
        uint256 stakingAvailableAt
    ) {
        Stake memory currentStake = stakes[roundId];
        return (
            roundId,
            currentStake.lastStaker,
            currentStake.amount,
            currentStake.deadline,
            currentStake.isActive,
            roundStakers[roundId].length,
            stakingStartTime
        );
    }

    function getRoundStakers(uint256 _roundId) external view returns (address[] memory) {
        return roundStakers[_roundId];
    }

    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= stakes[roundId].deadline) {
            return 0;
        }
        return stakes[roundId].deadline - block.timestamp;
    }

    function getTimeUntilStakingAvailable() external view returns (uint256) {
        if (block.timestamp >= stakingStartTime) {
            return 0;
        }
        return stakingStartTime - block.timestamp;
    }

    function isStakingAvailable() external view returns (bool) {
        return block.timestamp >= stakingStartTime && stakes[roundId].isActive && block.timestamp < stakes[roundId].deadline;
    }

    // Emergency functions
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner).call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    receive() external payable {
        stake();
    }
}