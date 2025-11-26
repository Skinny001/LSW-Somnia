"use client"

import { useEffect } from "react"
import { watchStakeEvents, watchRoundStartedEvents, watchRoundEndedEvents } from "@/lib/contract-service"
import { GameEventEmitters } from "@/lib/somnia-sdk"

export interface StakeEvent {
  roundId: bigint
  staker: string
  amount: bigint
  newDeadline: bigint
  timestamp: number
}

export interface RoundStartedEvent {
  roundId: bigint
  deadline: bigint
  stakingStartTime: bigint
  timestamp: number
}

export interface RoundEndedEvent {
  roundId: bigint
  winner: string
  totalAmount: bigint
  timestamp: number
}

export function useContractEvents(
  onStake?: (event: StakeEvent) => void,
  onRoundStarted?: (event: RoundStartedEvent) => void,
  onRoundEnded?: (event: RoundEndedEvent) => void,
) {
  useEffect(() => {
    const unsubscribers: Array<() => void> = []

    const setupWatchers = async () => {
      try {
        if (onStake) {
          const unsubscribe = await watchStakeEvents((roundId, staker, amount, newDeadline) => {
            onStake({
              roundId,
              staker,
              amount,
              newDeadline,
              timestamp: Date.now(),
            })
          })
          unsubscribers.push(unsubscribe)
        }

        if (onRoundStarted) {
          const unsubscribe = await watchRoundStartedEvents((roundId, deadline, stakingStartTime) => {
            onRoundStarted({
              roundId,
              deadline,
              stakingStartTime,
              timestamp: Date.now(),
            })
          })
          unsubscribers.push(unsubscribe)
        }

        if (onRoundEnded) {
          const unsubscribe = await watchRoundEndedEvents((roundId, winner, totalAmount) => {
            const event = {
              roundId,
              winner,
              totalAmount,
              timestamp: Date.now(),
            }
            
            // Emit to Somnia Streams
            try {
              GameEventEmitters.roundEnded(roundId.toString(), winner, totalAmount)
            } catch (err) {
              console.warn("Failed to emit roundEnded to Somnia Streams:", err)
            }
            
            onRoundEnded(event)
          })
          unsubscribers.push(unsubscribe)
        }
      } catch (error) {
        console.error("Error setting up contract event watchers:", error)
      }
    }

    setupWatchers()

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [onStake, onRoundStarted, onRoundEnded])
}
