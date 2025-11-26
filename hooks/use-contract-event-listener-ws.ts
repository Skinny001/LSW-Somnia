"use client"

import { useEffect, useCallback, useRef } from "react"
import { ethers } from "ethers"
import { LSW_ABI } from "@/lib/contract-abi"
import { LSW_CONTRACT_ADDRESS } from "@/lib/somnia-config"

export interface ContractEvent {
  eventName: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  timestamp: number
  args: any
  log: any
}

const WS_URL = "wss://dream-rpc.somnia.network/ws"

/**
 * Hook that connects to WebSocket and listens for all contract events in real-time
 * Calls the provided callback whenever an event is detected
 */
export function useContractEventListener(
  onEventDetected: (event: ContractEvent) => void
) {
  const providerRef = useRef<ethers.WebSocketProvider | null>(null)
  const listenersRef = useRef<Map<string, Function>>(new Map())
  const callbackRef = useRef(onEventDetected)

  // Keep callback ref in sync without triggering re-setup
  useEffect(() => {
    callbackRef.current = onEventDetected
  }, [onEventDetected])

  useEffect(() => {
    let isMounted = true
    let connectionAttempts = 0
    const maxRetries = 3

    const setupWebSocket = async () => {
      try {
        if (!isMounted) return

        const provider = new ethers.WebSocketProvider(WS_URL)
        await provider._waitUntilReady()

        if (!isMounted) return

        providerRef.current = provider
        connectionAttempts = 0

        // Define all event filters we want to listen for
        const eventSignatures = [
          "RoundStarted(uint256,uint256,uint256)",
          "RoundEnded(uint256,address,uint256)",
          "StakeReceived(uint256,address,uint256,uint256)",
          "RewardsDistributed(uint256,address,uint256,uint256,uint256)"
        ]

        // Create listeners for each event type
        const contract = new ethers.Contract(
          LSW_CONTRACT_ADDRESS as string,
          LSW_ABI,
          provider
        )

        // Listen for each event
        for (const signature of eventSignatures) {
          try {
            const eventName = signature.split("(")[0]
            const topicHash = ethers.id(signature)

            const filter = {
              address: LSW_CONTRACT_ADDRESS as string,
              topics: [topicHash]
            }

            const listener = async (log: any) => {
              try {
                if (!isMounted) return

                // Parse the log to get event data
                const parsedLog = contract.interface.parseLog(log)

                if (!parsedLog) return

                const event: ContractEvent = {
                  eventName: parsedLog.name,
                  blockNumber: log.blockNumber,
                  transactionHash: log.transactionHash,
                  logIndex: log.index,
                  timestamp: Math.floor(Date.now() / 1000),
                  args: parsedLog.args,
                  log
                }

                // Callback to parent component
                callbackRef.current(event)
              } catch (err) {
                console.error("Error processing event:", err)
              }
            }

            provider.on(filter, listener)
            listenersRef.current.set(signature, listener)
          } catch (err) {
            console.error(`Failed to setup listener for ${signature}:`, err)
          }
        }

        // Keep connection alive with periodic health checks
        const healthCheckInterval = setInterval(async () => {
          try {
            if (provider) {
              await provider.getBlockNumber()
            }
          } catch (err) {
            clearInterval(healthCheckInterval)
            if (isMounted) {
              setupWebSocket()
            }
          }
        }, 30000) // Check every 30 seconds

        return () => {
          clearInterval(healthCheckInterval)
        }
      } catch (err) {
        console.error("❌ WebSocket connection error:", err)

        if (connectionAttempts < maxRetries) {
          connectionAttempts++
          setTimeout(() => {
            if (isMounted) {
              setupWebSocket()
            }
          }, 5000)
        } else {
          console.error("❌ Failed to connect after max retries")
        }
      }
    }

    setupWebSocket()

    return () => {
      isMounted = false

      // Cleanup: remove all listeners
      if (providerRef.current) {
        try {
          listenersRef.current.forEach((listener, signature) => {
            const eventName = signature.split("(")[0]
            const topicHash = ethers.id(signature)
            const filter = {
              address: LSW_CONTRACT_ADDRESS as string,
              topics: [topicHash]
            }
            providerRef.current?.removeListener(filter, listener as any)
          })

          providerRef.current.destroy()
          providerRef.current = null
          listenersRef.current.clear()
        } catch (err) {
          console.error("Error cleaning up WebSocket:", err)
        }
      }
    }
  }, [])
}
