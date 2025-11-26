import { SDK, SchemaEncoder } from "@somnia-chain/streams"
import { createPublicClient, createWalletClient, http, toHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { somniaTestnet } from "@/lib/wagmi-config"

// Schema for RoundEnded events
const ROUND_ENDED_SCHEMA = "uint256 roundId, address winner, uint256 totalAmount, uint256 timestamp"

const { defineChain } = require("viem");
const dreamChain = defineChain({
  id: 50312,
  name: "Somnia Dream",
  network: "somnia-dream",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
});

// Server-side SDK initialization for publishing
export async function initializeSomniaSDKServer() {
  try {
    const privateKey = process.env.NEXT_PUBLIC_LSW_PUBLISHER_KEY as `0x${string}`

    if (!privateKey) {
      console.warn("⚠️ NEXT_PUBLIC_LSW_PUBLISHER_KEY not set - SDK publishing disabled")
      return null
    }

    const account = privateKeyToAccount(privateKey)

    const publicClient = createPublicClient({ chain: dreamChain, transport: http() })


    const walletClient = createWalletClient({
      account,
      chain: dreamChain,
      transport: http(),
    })

    const sdk = new SDK({ public: publicClient, wallet: walletClient })

    return sdk
  } catch (err) {
    console.error("❌ Failed to initialize Somnia SDK:", err)
    return null
  }
}

// Server-side function to publish RoundEnded event to Somnia Streams
export async function publishRoundEndedEventServer(
  roundId: bigint | string,
  winner: string,
  totalAmount: bigint | string,
  timestamp: number = Date.now()
) {
  try {
    const sdk = await initializeSomniaSDKServer()
    if (!sdk) {
      throw new Error("SDK not available - publisher key not configured")
    }

    // const schemaIdResult = await sdk.streams.computeSchemaId(ROUND_ENDED_SCHEMA)
    // const schemaId = schemaIdResult instanceof Error ? null : schemaIdResult
    const schemaId = process.env.NEXT_PUBLIC_LSW_STREAMS_SCHEMA_ID as `0x${string}`


    if (!schemaId) {
      throw new Error("Could not compute schema ID")
    }

    const encoder = new SchemaEncoder(ROUND_ENDED_SCHEMA)
    const data = encoder.encodeData([
      { name: "roundId", value: BigInt(roundId), type: "uint256" },
      { name: "winner", value: winner, type: "address" },
      { name: "totalAmount", value: BigInt(totalAmount), type: "uint256" },
      { name: "timestamp", value: BigInt(timestamp), type: "uint256" }
    ])

    const dataStreams = [
      {
        id: toHex(`round-ended-${roundId}`, { size: 32 }),
        schemaId: schemaId as `0x${string}`,
        data
      }
    ]

    const txHash = await sdk.streams.set(dataStreams)
    console.log(
      `✅ Published RoundEnded event to Somnia Streams: Round #${roundId}, Winner: ${winner}, Amount: ${totalAmount}, Tx: ${txHash}`
    )

    return txHash
  } catch (err) {
    console.error("❌ Failed to publish event:", err)
    throw err
  }
}
