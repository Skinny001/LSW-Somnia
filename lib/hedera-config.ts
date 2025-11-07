// Backwards-compat shim: re-export Somnia config under the old Hedera names.
// This file exists to avoid breaking third-party imports that still reference
// `@/lib/hedera-config`. Prefer importing from `@/lib/somnia-config`.
export {
	SOMNIA_CHAIN_ID as HEDERA_TESTNET_ID,
	SOMNIA_CHAIN_NAME as HEDERA_TESTNET_NAME,
	SOMNIA_RPC_URL as HEDERA_RPC_URL,
	LSW_CONTRACT_ADDRESS,
	REWARDER_CONTRACT_ADDRESS,
	MINIMUM_STAKE,
	USE_MOCK_SERVICE,
} from "./somnia-config"
