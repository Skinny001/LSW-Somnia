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



## License

This project is licensed under the UNLICENSED license.

## Support

For questions or issues, please create an issue in the repository or contact the development team.

### LSW Contract
- **Address:** `0xab20e6D156F6F1ea70793a70C01B1a379b603D50`
- **Explorer:** https://somnia.w3us.site/address/0xab20e6D156F6F1ea70793a70C01B1a379b603D50


### Rewarder Contract
- **Address:** `0x0673d3E814Ea61E3c7400E97E5ec31B6b84ff872`
- **Explorer:** https://somnia.w3us.site/address/0x0673d3E814Ea61E3c7400E97E5ec31B6b84ff872
