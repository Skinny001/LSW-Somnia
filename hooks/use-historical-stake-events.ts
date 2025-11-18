"use client"

import { useState, useEffect } from "react"
import { usePublicClient } from "wagmi"
import { LSW_CONTRACT_ADDRESS } from "@/lib/somnia-config"
import { LSW_ABI } from "@/lib/contract-abi"
import { decodeEventLog } from "viem"

export interface StakeEvent {
  id: string
  roundId: bigint
  staker: string
  amount: bigint
  newDeadline: bigint
  timestamp: number
  blockNumber: number
}

export function useHistoricalStakeEvents(roundId: bigint | undefined) {
  const publicClient = usePublicClient()
  const [stakeEvents, setStakeEvents] = useState<StakeEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicClient || roundId === undefined) {
      setStakeEvents([])
      return
    }

    const fetchHistoricalEvents = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get the latest block number
        const blockNumber = await publicClient.getBlockNumber()

        // Somnia RPC has 1000 block limit, so we'll use chunked queries
        const MAX_BLOCK_RANGE = 900 // Stay under 1000 limit with safety margin
        const totalRange = 2000 // Reduced range to avoid too many requests (was 10000)
        const fromBlock = blockNumber > BigInt(totalRange) ? blockNumber - BigInt(totalRange) : BigInt(0)

        // Get the event ABI
        const stakeReceivedEvent = LSW_ABI.find(
          (item) => item.type === "event" && item.name === "StakeReceived"
        ) as any

        if (!stakeReceivedEvent) {
          throw new Error("StakeReceived event not found in ABI")
        }

        // Helper function to chunk log queries
        const getLogsChunked = async (): Promise<any[]> => {
          const allLogs: any[] = []
          let currentFromBlock = fromBlock
          
          while (currentFromBlock < blockNumber) {
            const chunkToBlock = currentFromBlock + BigInt(MAX_BLOCK_RANGE) > blockNumber 
              ? blockNumber 
              : currentFromBlock + BigInt(MAX_BLOCK_RANGE)
            
            try {
              const chunkLogs = await publicClient.getLogs({
                address: LSW_CONTRACT_ADDRESS as `0x${string}`,
                event: stakeReceivedEvent,
                fromBlock: currentFromBlock,
                toBlock: chunkToBlock,
              })
              allLogs.push(...chunkLogs)
              
              // Move to next chunk
              currentFromBlock = chunkToBlock + BigInt(1)
            } catch (err) {
              console.warn(`Failed to fetch logs for block range ${currentFromBlock}-${chunkToBlock}:`, err)
              // Continue with next chunk instead of failing entirely
              currentFromBlock = chunkToBlock + BigInt(1)
            }
          }
          
          return allLogs
        }

        // Fetch logs using chunked approach
        const logs = await getLogsChunked()

        // Decode and filter logs
        const events: StakeEvent[] = []

        for (const log of logs) {
          try {
            const decoded = decodeEventLog({
              abi: LSW_ABI,
              data: log.data,
              topics: log.topics,
            }) as any

            if (decoded.eventName === "StakeReceived") {
              const args = decoded.args
              if (args.roundId === roundId) {
                // Get block for timestamp
                const block = await publicClient.getBlock({ blockNumber: log.blockNumber })

                events.push({
                  id: `stake-${log.transactionHash}-${log.logIndex}`,
                  roundId: args.roundId as bigint,
                  staker: args.staker as string,
                  amount: args.amount as bigint,
                  newDeadline: args.newDeadline as bigint,
                  timestamp: Number(block.timestamp) * 1000, // Convert to milliseconds
                  blockNumber: Number(log.blockNumber),
                })
              }
            }
          } catch (decodeErr) {
            console.warn("Failed to decode log:", decodeErr)
          }
        }

        // Sort by timestamp descending (newest first)
        events.sort((a, b) => b.timestamp - a.timestamp)

        setStakeEvents(events)
      } catch (err) {
        console.error("Failed to fetch historical stake events:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch events")
      } finally {
        setLoading(false)
      }
    }

    fetchHistoricalEvents()
  }, [publicClient, roundId])

  return { stakeEvents, loading, error }
}
