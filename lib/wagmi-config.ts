import { defineChain, http } from "viem"
import { createConfig, cookieStorage, createStorage } from "wagmi"
import { injected } from "wagmi/connectors"
import { SOMNIA_CHAIN_ID, SOMNIA_CHAIN_NAME, SOMNIA_RPC_URL } from "./somnia-config"

// Define Somnia Testnet chain
export const somniaTestnet = defineChain({
  id: SOMNIA_CHAIN_ID,
  name: SOMNIA_CHAIN_NAME,
  nativeCurrency: { name: "Somnia Token", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: [SOMNIA_RPC_URL] },
  },
  blockExplorers: {
    // Explorer URL is optional; update if you have an official Somnia explorer URL
    default: { name: "Somnia Explorer", url: "https://explorer.somnia.network" },
  },
})

// Create wagmi config for Somnia Testnet
export const wagmiConfig = createConfig({
  chains: [somniaTestnet],
  connectors: [injected()],
  transports: {
    [somniaTestnet.id]: http(SOMNIA_RPC_URL),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
})
