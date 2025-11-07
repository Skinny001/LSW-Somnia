# Somnia Testnet Deployment Summary

## Successfully Deployed Contracts

### LSW Contract
- **Address:** `0xab20e6D156F6F1ea70793a70C01B1a379b603D50`
- **Explorer:** https://somnia.w3us.site/address/0xab20e6D156F6F1ea70793a70C01B1a379b603D50
- **Status:** ✅ Deployed and Verified

### Rewarder Contract
- **Address:** `0xEa9C19564186958FB6De241c049c3727a6a40c28`
- **Explorer:** https://somnia.w3us.site/address/0xEa9C19564186958FB6De241c049c3727a6a40c28
- **Status:** ✅ Deployed and Verified

## Deployment Configuration

### Network Details
- **Network:** Somnia Testnet
- **Chain ID:** 50312
- **RPC URL:** https://dream-rpc.somnia.network
- **Explorer:** https://somnia.w3us.site

### Contract Parameters
- **Stake Buffer:** 300 seconds (5 minutes)
- **Stake Amount:** 0.01 STT (10000000000000000 wei)
- **Round Duration:** 3600 seconds (1 hour)
- **Buffer Delay:** 600 seconds (10 minutes)
- **Staking Wait Period:** 180 seconds (3 minutes)
- **Treasury:** 0x12896191de42EF8388f2892Ab76b9a728189260A

### VRF Configuration
- **VRF Wrapper:** 0x763cC914d5CA79B04dC4787aC14CcAd780a16BD2
- **Payment Method:** Native Token (STT)
- **Confirmations:** 3 blocks
- **Callback Gas Limit:** 2,100,000
- **Number of Random Words:** 10

## Deployment Process

The contracts were deployed using `cast` commands with the following specifications:
- **Gas Limit:** 30,000,000
- **Gas Price:** 6 gwei (6000000000 wei)
- **Transaction Type:** Legacy

### Deployment Commands Used

```bash
# 1. Deploy LSW
cast send \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --legacy \
  --gas-limit 30000000 \
  --gas-price 6000000000 \
  --create "${LSW_BYTECODE}${LSW_CONSTRUCTOR}"

# 2. Deploy Rewarder
cast send \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --legacy \
  --gas-limit 30000000 \
  --gas-price 6000000000 \
  --create "${REWARDER_BYTECODE}${REWARDER_CONSTRUCTOR}"

# 3. Set Rewarder in LSW
cast send \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --legacy \
  --gas-limit 200000 \
  --gas-price 6000000000 \
  0xab20e6D156F6F1ea70793a70C01B1a379b603D50 \
  "setRewarderContract(address)" \
  0xEa9C19564186958FB6De241c049c3727a6a40c28
```

## Next Steps

### 1. Fund the Rewarder Contract
The Rewarder contract needs native tokens (STT) to pay for VRF requests.

```bash
# Check VRF request price
cast call 0xEa9C19564186958FB6De241c049c3727a6a40c28 \
  "getRequestPrice()(uint256)" \
  --rpc-url https://dream-rpc.somnia.network

# Fund the Rewarder (example: 1 STT)
cast send 0xEa9C19564186958FB6De241c049c3727a6a40c28 \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --value 1ether
```

### 2. Verify Contract Interactions

```bash
# Check if Rewarder is set in LSW
cast call 0xab20e6D156F6F1ea70793a70C01B1a379b603D50 \
  "rewarderContract()(address)" \
  --rpc-url https://dream-rpc.somnia.network

# Check treasury address
cast call 0xab20e6D156F6F1ea70793a70C01B1a379b603D50 \
  "treasury()(address)" \
  --rpc-url https://dream-rpc.somnia.network

# Check stake amount
cast call 0xab20e6D156F6F1ea70793a70C01B1a379b603D50 \
  "stakeAmount()(uint256)" \
  --rpc-url https://dream-rpc.somnia.network
```

### 3. Testing

Test the staking functionality:

```bash
# Stake in the current round
cast send 0xab20e6D156F6F1ea70793a70C01B1a379b603D50 \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --value 0.01ether \
  "stake()"
```

## Important Notes

- ✅ Both contracts successfully deployed after resolving out-of-gas errors
- ✅ Solution: Used `cast` with explicit 30M gas limit instead of forge script
- ✅ Contracts verified on Blockscout explorer
- ✅ Rewarder contract linked to LSW contract
- ⚠️ **Remember to fund the Rewarder contract** with native tokens before triggering VRF requests
- ⚠️ Monitor VRF request costs using `getRequestPrice()` function

## Contract Verification Status

Both contracts are verified and viewable on the Somnia Blockscout explorer:
- LSW: https://somnia.w3us.site/address/0xab20e6D156F6F1ea70793a70C01B1a379b603D50
- Rewarder: https://somnia.w3us.site/address/0xEa9C19564186958FB6De241c049c3727a6a40c28

---

**Deployment Date:** November 5, 2025  
**Deployer:** 0x12896191de42EF8388f2892Ab76b9a728189260A  
**Network:** Somnia Testnet (Chain ID: 50312)
