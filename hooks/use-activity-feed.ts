"use client"

import { useEffect, useState, useCallback } from "react"
import { useContractEventListener, ContractEvent } from "@/hooks/use-contract-event-listener-ws"

export interface ActivityEvent extends ContractEvent {
  id: string // Unique identifier: txHash + logIndex
  displayText: string
}

const LSW_CONTRACT = "0xab20e6D156F6F1ea70793a70C01B1a379b603D50"

/**
 * Hook that manages the activity feed
 * - Loads historical events from Logs API on mount
 * - Listens for new events via WebSocket
 * - Combines both for a complete feed
 */
export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seenEventIds] = useState(() => new Set<string>())

  // Load historical events from Logs API
  const loadHistoricalEvents = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const apiUrl = `https://somnia.w3us.site/api/v2/addresses/${LSW_CONTRACT}/logs`

      const response = await fetch(apiUrl)


      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()

      
      const allLogs = data.items || []


      // Parse and format events
      const historicalEvents: ActivityEvent[] = []
      const loadedIds = new Set<string>() // Track IDs from THIS load only

      for (const log of allLogs) {
        try {
          const methodCall = log.decoded?.method_call
          const eventName = methodCall?.split("(")?.[0]

          if (!eventName) {
            continue
          }

          const id = `${log.transaction_hash}-${log.index}`

          // Only check if we've already seen this in THIS load (avoid duplicates from API)
          if (loadedIds.has(id)) {
            continue
          }
          loadedIds.add(id)

          const params = log.decoded?.parameters || []

          let displayText = `${eventName}`

          // Format event display text based on event type
          if (eventName === "RoundEnded") {
            const roundId = params.find((p: any) => p.name === "roundId")?.value
            const winner = params.find((p: any) => p.name === "winner")?.value
            displayText = `🏆 Round #${roundId} ended - Winner: ${winner?.slice(0, 6)}...${winner?.slice(-4)}`
          } else if (eventName === "RoundStarted") {
            const roundId = params.find((p: any) => p.name === "roundId")?.value
            displayText = `▶️ Round #${roundId} started`
          } else if (eventName === "StakeReceived") {
            const roundId = params.find((p: any) => p.name === "roundId")?.value
            const staker = params.find((p: any) => p.name === "staker")?.value
            const amount = params.find((p: any) => p.name === "amount")?.value
            displayText = `💰 ${staker?.slice(0, 6)}...${staker?.slice(-4)} staked ${amount} in Round #${roundId}`
          } else if (eventName === "StakeWithdrawn" || eventName === "Unstaked") {
            const roundId = params.find((p: any) => p.name === "roundId")?.value
            const staker = params.find((p: any) => p.name === "staker")?.value
            displayText = `↩️ ${staker?.slice(0, 6)}...${staker?.slice(-4)} unstaked from Round #${roundId}`
          } else if (eventName === "RewardClaimed") {
            const user = params.find((p: any) => p.name === "user")?.value
            const amount = params.find((p: any) => p.name === "amount")?.value
            displayText = `🎁 ${user?.slice(0, 6)}...${user?.slice(-4)} claimed reward`
          } else if (eventName === "RewardsDistributed") {
            const roundId = params.find((p: any) => p.name === "roundId")?.value
            const winner = params.find((p: any) => p.name === "winner")?.value
            const winnerAmount = params.find((p: any) => p.name === "winnerAmount")?.value
            displayText = `💸 Rewards distributed for Round #${roundId} - Winner: ${winner?.slice(0, 6)}...${winner?.slice(-4)}`
          }

          const event: ActivityEvent = {
            id,
            eventName,
            blockNumber: log.block_number,
            transactionHash: log.transaction_hash,
            logIndex: log.index,
            timestamp: Math.floor(Date.now() / 1000),
            args: params,
            log,
            displayText
          }

          historicalEvents.push(event)
        } catch (err) {
          console.error("Error parsing event:", err)
        }
      }

      // Sort by block number descending (newest first)
      historicalEvents.sort((a, b) => b.blockNumber - a.blockNumber)

      // Update seenEventIds with all loaded event IDs
      // This allows WebSocket events to check against historical events
      historicalEvents.forEach(e => seenEventIds.add(e.id))

      setEvents(historicalEvents)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      console.error("❌ Error loading historical events:", errorMsg)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle new events from WebSocket
  const handleNewEvent = useCallback((wsEvent: ContractEvent) => {
    const id = `${wsEvent.transactionHash}-${wsEvent.logIndex}`

    // Skip if we've already seen this event
    if (seenEventIds.has(id)) {
      return
    }

    seenEventIds.add(id)

    let displayText = `${wsEvent.eventName}`

    // Format display text based on event type
    if (wsEvent.eventName === "RoundEnded") {
      const roundId = wsEvent.args[0]
      const winner = wsEvent.args[1]
      displayText = `🏆 Round #${roundId} ended - Winner: ${String(winner).slice(0, 6)}...${String(winner).slice(-4)}`
    } else if (wsEvent.eventName === "RoundStarted") {
      const roundId = wsEvent.args[0]
      displayText = `▶️ Round #${roundId} started`
    } else if (wsEvent.eventName === "StakeReceived") {
      const roundId = wsEvent.args[0]
      const staker = wsEvent.args[1]
      const amount = wsEvent.args[2]
      displayText = `💰 ${String(staker).slice(0, 6)}...${String(staker).slice(-4)} staked in Round #${roundId}`
    } else if (wsEvent.eventName === "RewardsDistributed") {
      const roundId = wsEvent.args[0]
      displayText = `💸 Rewards distributed for Round #${roundId}`
    } else if (wsEvent.eventName === "StakeWithdrawn" || wsEvent.eventName === "Unstaked") {
      const roundId = wsEvent.args[0]
      const staker = wsEvent.args[1]
      displayText = `↩️ ${String(staker).slice(0, 6)}...${String(staker).slice(-4)} unstaked from Round #${roundId}`
    } else if (wsEvent.eventName === "RewardClaimed") {
      const user = wsEvent.args[0]
      displayText = `🎁 ${String(user).slice(0, 6)}...${String(user).slice(-4)} claimed reward`
    }

    const event: ActivityEvent = {
      ...wsEvent,
      id,
      displayText
    }

    // Add to beginning of array (newest first)
    setEvents(prev => [event, ...prev].slice(0, 100)) // Keep last 100 events
  }, [])

  // Setup WebSocket listener
  useContractEventListener(handleNewEvent)

  // Load historical events on mount
  useEffect(() => {
    loadHistoricalEvents()
  }, [])

  return {
    events,
    isLoading,
    error,
    refresh: loadHistoricalEvents
  }
}
