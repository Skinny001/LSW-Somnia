// Somnia Testnet Configuration (allow overrides via NEXT_PUBLIC_ env vars)
export const SOMNIA_CHAIN_ID = Number(process.env.NEXT_PUBLIC_SOMNIA_CHAIN_ID ?? 50312)
export const SOMNIA_CHAIN_NAME = process.env.NEXT_PUBLIC_SOMNIA_CHAIN_NAME ?? "Somnia Testnet"
export const SOMNIA_RPC_URL = process.env.NEXT_PUBLIC_SOMNIA_RPC_URL ?? "https://dream-rpc.somnia.network"

// Contract addresses for Somnia deployment (can be overridden via env vars)
export const LSW_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LSW_CONTRACT_ADDRESS ?? "0xab20e6D156F6F1ea70793a70C01B1a379b603D50"
export const REWARDER_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_REWARDER_CONTRACT_ADDRESS ?? "0xEa9C19564186958FB6De241c049c3727a6a40c28"

// Minimum stake default (keep as bigint). Adjust if Somnia token uses different decimals.
// Default minimum stake: 0.01 STT (18 decimals) = 10^16
export const MINIMUM_STAKE = BigInt(process.env.NEXT_PUBLIC_MINIMUM_STAKE ?? "10000000000000000")

// feature toggle: if set to "true" client will fall back to mock service
export const USE_MOCK_SERVICE = (process.env.NEXT_PUBLIC_USE_MOCK_SERVICE ?? "false") === "true"

// NOTE: We intentionally keep `LSW_CONTRACT_ADDRESS` name to minimize changes across the codebase.
