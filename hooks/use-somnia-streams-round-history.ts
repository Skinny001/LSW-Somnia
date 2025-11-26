"use client"

import { useEffect, useState, useCallback } from "react"
import { createPublicClient, http } from "viem"
import { somniaTestnet } from "@/lib/wagmi-config"
import { SDK, SchemaEncoder } from "@somnia-chain/streams"
import { fetchRecentRounds } from "@/lib/contract-service"

export interface RoundEndedEvent {
  roundId: bigint
  winner: string
  totalAmount: bigint
  timestamp: number
}

const ROUND_ENDED_SCHEMA = "uint256 roundId, address winner, uint256 totalAmount, uint256 timestamp"
const PUBLISHER_ADDRESS = process.env.NEXT_PUBLIC_LSW_PUBLISHER_KEY?.startsWith("0x") 
  ? process.env.NEXT_PUBLIC_LSW_PUBLISHER_KEY 
  : "0x311350f1c7ba0f1749572cc8a948dd7f9af1f42a"

export function useSomniaStreamsRoundHistory() {
  const [events, setEvents] = useState<RoundEndedEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schemaId, setSchemaId] = useState<string | null>(null)

  const fetchFromSomniaStreams = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Try Somnia Streams first
      const publicClient = createPublicClient({
        chain: somniaTestnet,
        transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://dream-rpc.somnia.network")
      })

      const sdk = new SDK({
        public: publicClient
      })

      // Get schema ID
      const schemaIdResult = await sdk.streams.computeSchemaId(ROUND_ENDED_SCHEMA)
      const schemaId = schemaIdResult instanceof Error ? null : schemaIdResult

      if (!schemaId) {
        throw new Error("Could not compute schema ID - falling back to contract logs")
      }



      // Fetch all publisher data for this schema


      let allData: any
      try {
        allData = await sdk.streams.getAllPublisherDataForSchema(
          schemaId as `0x${string}`,
          PUBLISHER_ADDRESS as `0x${string}`
        )
      } catch (err: any) {
        // If schema is private or unavailable, silently continue with empty data
        // This is common in development environments

        allData = []
      }

      // Handle different response formats
      let dataArray: any[] = []
      if (Array.isArray(allData)) {
        dataArray = allData
      } else if (allData && typeof allData === "object" && "data" in allData && Array.isArray((allData as any).data)) {
        dataArray = (allData as any).data
      }



      // If we got data from streams, decode it
      if (dataArray.length > 0) {
        const encoder = new SchemaEncoder(ROUND_ENDED_SCHEMA)
        const decodedEvents: RoundEndedEvent[] = []

        for (let i = 0; i < dataArray.length; i++) {
          try {
            const decoded = encoder.decodeData(dataArray[i])

            const roundIdValue = decoded[0]?.value?.value ?? decoded[0]?.value ?? 0
            const winnerValue = decoded[1]?.value?.value ?? decoded[1]?.value ?? "0x0"
            const amountValue = decoded[2]?.value?.value ?? decoded[2]?.value ?? 0
            const timestampValue = decoded[3]?.value?.value ?? decoded[3]?.value ?? Date.now()

            const event: RoundEndedEvent = {
              roundId: BigInt(String(roundIdValue)),
              winner: String(winnerValue),
              totalAmount: BigInt(String(amountValue)),
              timestamp: Number(timestampValue)
            }

            decodedEvents.push(event)
          } catch (decodeErr) {
            console.error(`❌ Failed to decode event ${i}:`, decodeErr)
          }
        }

        // Sort by roundId descending (newest first)
        decodedEvents.sort((a, b) => Number(b.roundId - a.roundId))


        setEvents(decodedEvents)
        return
      }

      // Fallback: Fetch from contract logs

      const rounds = await fetchRecentRounds(20)
      setEvents(rounds)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      console.warn("⚠️ Error fetching round history:", errorMsg, "- will retry on next poll")
      // Silently handle errors - the component will show empty state or cached data
      setError(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchFromSomniaStreams()

    // Poll every 10 seconds for new events
    const interval = setInterval(fetchFromSomniaStreams, 10000)

    return () => clearInterval(interval)
  }, [fetchFromSomniaStreams])

  return { events, isLoading, error, refresh: fetchFromSomniaStreams }
}
