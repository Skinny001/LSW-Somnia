"use client"

import { SDK, SchemaEncoder, zeroBytes32 } from "@somnia-chain/streams"
import { createPublicClient, createWalletClient, http, toHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { somniaTestnet } from "@/lib/wagmi-config"

// Schema for RoundEnded events
const ROUND_ENDED_SCHEMA = "uint256 roundId, address winner, uint256 totalAmount, uint256 timestamp"

// Initialize SDK for publishing (server-side)
export async function initializeSomniaSDK() {
  try {
    const privateKey = process.env.NEXT_PUBLIC_LSW_PUBLISHER_KEY as `0x${string}`
    
    if (!privateKey) {
      console.warn("⚠️ NEXT_PUBLIC_LSW_PUBLISHER_KEY not set - SDK publishing disabled")
      return null
    }

    const account = privateKeyToAccount(privateKey)
    
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://dream-rpc.somnia.network")
    })

    const walletClient = createWalletClient({
      account,
      chain: somniaTestnet,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://dream-rpc.somnia.network")
    })

    const sdk = new SDK({
      public: publicClient,
      wallet: walletClient
    })


    return sdk
  } catch (err) {
    console.error("❌ Failed to initialize Somnia SDK:", err)
    return null
  }
}

/**
 * Compute RoundEnded schema ID using provided SDK
 */
export async function computeRoundEndedSchemaId(sdk: any): Promise<string | null> {
  try {
    if (!sdk || !sdk.streams) {
      console.error("❌ SDK or SDK.streams not available")
      return null
    }
    
    const schemaId = await sdk.streams.computeSchemaId(ROUND_ENDED_SCHEMA)

    return schemaId
  } catch (err) {
    console.error("❌ Failed to compute schema ID:", err)
    return null
  }
}

// Register RoundEnded schema on Somnia Streams
export async function registerRoundEndedSchema() {
  try {
    // Just compute the schema ID - no publisher key needed for reading
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://dream-rpc.somnia.network")
    })

    const sdk = new SDK({
      public: publicClient
    })

    const schemaId = await computeRoundEndedSchemaId(sdk)
    
    // Note: Schema registration would require a private key (publisher)
    // For now, we just compute the schema ID for reading events
    // Schema should be registered by the contract/backend service
    
    return schemaId
  } catch (err) {
    console.error("❌ Failed to get schema ID:", err)
    return null
  }
}

// Publish RoundEnded event to Somnia Streams
export async function publishRoundEndedEvent(
  roundId: bigint,
  winner: string,
  totalAmount: bigint,
  timestamp: number
) {
  try {
    const sdk = await initializeSomniaSDK()
    if (!sdk) {
      console.warn("⚠️ SDK not available, cannot publish event")
      return null
    }

    const schemaIdResult = await sdk.streams.computeSchemaId(ROUND_ENDED_SCHEMA)
    const schemaId = (schemaIdResult instanceof Error) ? null : schemaIdResult
    
    if (!schemaId) {
      console.warn("⚠️ Could not get schema ID")
      return null
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

    
    return txHash
  } catch (err) {
    console.error("❌ Failed to publish event:", err)
    return null
  }
}

// Subscribe to RoundEnded events from Somnia Streams
export async function subscribeToRoundEndedEvents(
  publisherAddress: string,
  onRoundEnded: (event: { roundId: bigint; winner: string; totalAmount: bigint; timestamp: number }) => void,
  onError?: (err: Error) => void
) {
  try {
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://dream-rpc.somnia.network")
    })

    const sdk = new SDK({
      public: publicClient
    })

    const schemaIdResult = await sdk.streams.computeSchemaId(ROUND_ENDED_SCHEMA)
    const schemaId = (schemaIdResult instanceof Error) ? null : schemaIdResult
    
    if (!schemaId) {
      console.error("❌ Could not compute schema ID")
      if (onError) {
        onError(new Error("Could not compute schema ID"))
      }
      return () => {}
    }
    
    const encoder = new SchemaEncoder(ROUND_ENDED_SCHEMA)



    // Poll for new RoundEnded events
    const pollInterval = setInterval(async () => {
      try {
        const allData = await sdk.streams.getAllPublisherDataForSchema(schemaId as `0x${string}`, publisherAddress as `0x${string}`)
        
        // Handle different response formats
        let events: any[] = []
        if (Array.isArray(allData)) {
          events = allData
        } else if (allData && typeof allData === 'object' && 'data' in allData && Array.isArray((allData as any).data)) {
          events = (allData as any).data
        }
        
        if (!events || events.length === 0) {

          return
        }



        for (const item of events) {
          try {
            const decoded = encoder.decodeData(item)
            
            const roundIdValue = decoded[0]?.value?.value ?? decoded[0]?.value ?? 0
            const winnerValue = decoded[1]?.value?.value ?? decoded[1]?.value ?? "0x0"
            const amountValue = decoded[2]?.value?.value ?? decoded[2]?.value ?? 0
            const timestampValue = decoded[3]?.value?.value ?? decoded[3]?.value ?? Date.now()
            
            const roundId = BigInt(String(roundIdValue))
            const winner = String(winnerValue)
            const totalAmount = BigInt(String(amountValue))
            const timestamp = Number(timestampValue)



            onRoundEnded({
              roundId,
              winner,
              totalAmount,
              timestamp
            })
          } catch (decodeErr) {
            console.error("❌ Failed to decode event:", decodeErr)
          }
        }
      } catch (err) {
        console.error("❌ Error polling for events:", err)
        if (onError && err instanceof Error) {
          onError(err)
        }
      }
    }, 5000) // Poll every 5 seconds

    // Return unsubscribe function
    return () => {
      clearInterval(pollInterval)

    }
  } catch (err) {
    console.error("❌ Failed to setup subscription:", err)
    if (onError && err instanceof Error) {
      onError(err)
    }
    return () => {}
  }
}

// Publish test/demo RoundEnded events for testing
export async function publishTestRoundEndedEvent(
  roundId: number = 1,
  winner: string = "0x372b4eB67006F68A9f296b23715055b8A878ABA9",
  totalAmount: bigint = BigInt(5e18), // 5 STT
  timestamp: number = Math.floor(Date.now() / 1000)
) {
  try {


    const sdk = await initializeSomniaSDK()
    if (!sdk) {
      console.error("❌ SDK not available - cannot publish test event")

      return null
    }

    const schemaIdResult = await sdk.streams.computeSchemaId(ROUND_ENDED_SCHEMA)
    const schemaId = (schemaIdResult instanceof Error) ? null : schemaIdResult

    if (!schemaId) {
      console.error("❌ Could not compute schema ID")
      return null
    }

    const encoder = new SchemaEncoder(ROUND_ENDED_SCHEMA)
    const data = encoder.encodeData([
      { name: "roundId", value: BigInt(roundId), type: "uint256" },
      { name: "winner", value: winner, type: "address" },
      { name: "totalAmount", value: totalAmount, type: "uint256" },
      { name: "timestamp", value: BigInt(timestamp), type: "uint256" }
    ])

    const dataStreams = [
      {
        id: toHex(`test-round-${roundId}-${Date.now()}`, { size: 32 }),
        schemaId: schemaId as `0x${string}`,
        data
      }
    ]

    const txHash = await sdk.streams.set(dataStreams)


    return txHash
  } catch (err) {
    console.error("❌ Failed to publish test event:", err)
    return null
  }
}

// Utility function to publish multiple test events
export async function publishMultipleTestEvents(count: number = 3) {

  
  for (let i = 1; i <= count; i++) {
    const winner = `0x${Math.random().toString(16).slice(2, 42).padEnd(40, '0')}`
    const amount = BigInt(Math.floor(Math.random() * 10 + 1) * 1e18) // Random 1-10 STT
    
    await publishTestRoundEndedEvent(i, winner, amount)
    
    // Small delay between publishes
    if (i < count) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  

}

