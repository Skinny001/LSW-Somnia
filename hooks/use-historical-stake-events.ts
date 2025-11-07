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

        // Fetch past StakeReceived events for the current round
        // Look back 10000 blocks (or from block 0 if fewer blocks exist)
        const fromBlock = blockNumber > BigInt(10000) ? blockNumber - BigInt(10000) : BigInt(0)

        // Get the event ABI
        const stakeReceivedEvent = LSW_ABI.find(
          (item) => item.type === "event" && item.name === "StakeReceived"
        ) as any

        if (!stakeReceivedEvent) {
          throw new Error("StakeReceived event not found in ABI")
        }

        // Fetch logs
        const logs = await publicClient.getLogs({
          address: LSW_CONTRACT_ADDRESS as `0x${string}`,
          event: stakeReceivedEvent,
          fromBlock,
          toBlock: blockNumber,
        })

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
