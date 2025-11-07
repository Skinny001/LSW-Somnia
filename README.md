# Last Staker Win (LSW) - Smart Contract

## Overview

Last Staker Win (LSW) is a blockchain-based game where participants stake ETH to become the "last staker" within a time window. The last person to stake before the deadline wins the majority of the pool, while other participants and the platform treasury receive smaller rewards.

## Contract Architecture

The system consists of two main contracts:

### 1. LSW Contract (`LSW.sol`)
The main game contract that handles:
- Round management and timing
- Stake collection and validation
- Winner determination
- Emergency functions

### 2. Rewarder Contract (`rewarder.sol`)
Handles reward distribution using Chainlink VRF for fairness:
- Random participant selection (when >10 participants)
- Reward distribution to winners and participants
- Platform treasury management
- VRF integration for true randomness

## How It Works

### Game Flow

1. **Round Initialization**: A new round starts with a fixed duration (default: 1 hour)

2. **Wait Period**: After a new round starts, there's a configurable wait period (default: 10 minutes) before staking becomes available

3. **Staking Phase**: 
   - Users can stake ETH after the wait period ends (minimum amount required)
   - Each stake extends the deadline if made within the buffer period
   - The last person to stake becomes the potential winner

4. **Round End**:
   - Round ends when the deadline passes
   - The last staker becomes the winner
   - Stakes are locked until reward distribution

5. **Reward Distribution**:
   - **70%** goes to the winner
   - **20%** is distributed among random participants (up to 10)
   - **10%** goes to the platform treasury

6. **New Round**: Winner or contract owner can start the next round (with a new wait period)

### Timing Mechanics

- **Round Duration**: Base time for each round (configurable)
- **Staking Wait Period**: Time after round starts before staking becomes available (default: 10 minutes)
- **Buffer Delay**: If a stake occurs within this time of the deadline, it may extend the round
- **Stake Buffer**: Amount of time added to deadline when staking in buffer period

Example: After a new round starts, users must wait 10 minutes before they can stake. Once staking is available, if someone stakes within 10 minutes of the deadline (buffer delay), the deadline extends by the stake buffer amount.

## Key Features

### Fair Random Distribution
- Uses Chainlink VRF for provably fair random participant selection
- Automatically distributes among all participants if ≤10 people
- Selects 10 random participants if >10 people (duplicates allowed)

### Security Features
- Owner-only administrative functions
- Emergency withdrawal capabilities
- Input validation and error handling
- Reentrancy protection through careful state management
- Staking wait period prevents immediate staking rushes after new rounds

### Anti-Gridlock Protection
- Stake function no longer attempts refunds for expired rounds (prevents contract halts)
- Clear error messages for different failure scenarios
- Round expiration handling moved to `startNewRound()` function

### Flexible Configuration
- Adjustable stake amounts
- Configurable timing parameters
- Updatable treasury and rewarder addresses

## Contract Deployment

### Prerequisites

1. **Foundry Installation**: Make sure you have Foundry installed
2. **Environment Setup**: Create a `.env` file with:
   ```
   PRIVATE_KEY=your_private_key_here
   ```
3. **Chainlink VRF Subscription**: 
   - Create a VRF subscription at [vrf.chain.link](https://vrf.chain.link)
   - Fund it with LINK tokens
   - Note your subscription ID

### Deployment Steps

1. **Update Configuration**: Edit `script/LSW.s.sol` and update:
   - `VRF_COORDINATOR`: Address for your network
   - `KEY_HASH`: Gas lane for your network
   - `SUBSCRIPTION_ID`: Your VRF subscription ID
   - `TREASURY`: Your treasury address
   - Timing and stake parameters as needed

2. **Deploy to Network**:
   ```bash
   # For mainnet/testnet with real VRF
   forge script script/LSW.s.sol:LSWScript --rpc-url <your_rpc_url> --broadcast --verify
   
   # For local testing with mock VRF
   forge script script/LSW.s.sol:LSWScript --rpc-url http://localhost:8545 --broadcast --sig "deployWithMockVRF()"
   ```

3. **Post-Deployment**:
   - Add the deployed Rewarder contract as a consumer to your VRF subscription
   - Verify the contract source code on the block explorer
   - Test with small amounts first

## Testing

The project includes comprehensive tests covering:

### Unit Tests
- **LSW.t.sol**: Tests for the main LSW contract
- **Rewarder.t.sol**: Tests for the Rewarder contract
- **Integration.t.sol**: End-to-end integration tests

### Test Coverage
- Round lifecycle management
- Staking mechanics and validation
- Timing and deadline extensions
- Reward distribution logic
- VRF integration and fallbacks
- Access control and permissions
- Edge cases and error conditions

### Running Tests

```bash
# Run all tests
forge test

# Run tests with verbose output
forge test -vvv

# Run specific test file
forge test --match-path test/LSW.t.sol

# Run with gas reporting
forge test --gas-report

# Generate coverage report
forge coverage
```

## Network Configuration

## Base Sepolia
- VRF Coordinator: `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE`
- Key Hash (500 gwei): `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71`

### Polygon Mainnet
- VRF Coordinator: `0xAE975071Be8F8eE67addBC1A82488F1C24858067`
- Key Hash (500 gwei): `0xcc294a196eeeb44da2888d17c0625cc88d70d9760a69d58d853ba6581a9ab0cd`

### Polygon Mumbai Testnet
- VRF Coordinator: `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed`
- Key Hash (500 gwei): `0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f`

### Ethereum Mainnet
- VRF Coordinator: `0x271682DEB8C4E0901D1a1550aD2e64D568E69909`
- Key Hash (500 gwei): `0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef`

## API Reference

### LSW Contract

#### Main Functions
- `stake()`: Participate in the current round (after wait period)
- `startNewRound()`: Start a new round (winner or owner only)
- `getCurrentRoundInfo()`: Get current round information including staking availability
- `getTimeRemaining()`: Get time remaining in current round
- `getTimeUntilStakingAvailable()`: Get time until staking becomes available
- `isStakingAvailable()`: Check if staking is currently allowed

#### Admin Functions
- `setRewarderContract(address)`: Set the rewarder contract
- `setTreasury(address)`: Update treasury address
- `updateStakeAmount(uint256)`: Update minimum stake amount
- `updateBufferSettings(uint256, uint256)`: Update timing parameters
- `updateStakingWaitPeriod(uint256)`: Update staking wait period
- `emergencyWithdraw()`: Emergency withdrawal (owner only)

### Rewarder Contract

#### Main Functions
- `rewardRandomParticipants()`: Distribute rewards (LSW contract only)
- `manualDistribution(uint256)`: Manual reward distribution (owner only)

#### Admin Functions
- `updateLSWContract(address)`: Update LSW contract address
- `updateVRFConfig()`: Update Chainlink VRF configuration
- `emergencyWithdraw()`: Emergency withdrawal (owner only)

## Events

### LSW Contract Events
- `RoundStarted(uint256 roundId, uint256 deadline)`
- `StakeReceived(uint256 roundId, address staker, uint256 amount, uint256 newDeadline)`
- `RoundEnded(uint256 roundId, address winner, uint256 totalAmount)`
- `RewardsDistributed(uint256 roundId, address winner, uint256 winnerAmount, uint256 participantAmount, uint256 treasuryAmount)`

### Common Error Messages
- `StakingNotYetAvailable()`: Attempted to stake during wait period
- `RoundExpired()`: Attempted to stake after round deadline
- `InsufficientStakeAmount()`: Stake amount below minimum required
- `RoundNotEnded()`: Attempted to start new round before current ends

### Rewarder Contract Events
- `RandomnessRequested(uint256 roundId, uint256 requestId)`
- `RewardsDistributed(uint256 roundId, address[] winners, uint256 rewardPerWinner, uint256 treasuryAmount)`
- `VRFConfigUpdated(address coordinator, bytes32 keyHash, uint64 subId)`

## Security Considerations

1. **Chainlink VRF Dependency**: The system relies on Chainlink VRF for fair randomness
2. **Manual Fallback**: Manual distribution is available if VRF fails
3. **Access Control**: Strict permissions for critical functions
4. **Emergency Functions**: Owner can withdraw funds in emergencies
5. **Input Validation**: All inputs are validated before processing

## Gas Optimization

- Efficient storage layout with struct packing
- Minimal external calls during staking
- Batch operations where possible
- Event emissions for off-chain indexing

## Upgradeability

The contracts are not upgradeable by design for security and trust. However, configuration parameters can be adjusted by the owner:
- Stake amounts and timing parameters
- Treasury and rewarder addresses
- VRF configuration

## License

This project is licensed under the UNLICENSED license.

## Support

For questions or issues, please create an issue in the repository or contact the development team.

---

## Deployment Address ON Base Sepolia 
 - LSW deployed at: 0x9a849937149f69921375a95f67c9ffDF0ECf2732
 - Rewarder deployed at: 0x1FE132d12771e5dD296144123C2bA5B87987a96B

**⚠️ Important**: Always test thoroughly on testnets before mainnet deployment. Never deploy with real funds without proper testing and security audits.
