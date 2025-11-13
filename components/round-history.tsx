"use client"
import React, { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { formatEther } from "@/lib/format-utils"
import { watchRoundEndedEvents } from "@/lib/contract-service"
import { Button } from "./ui/button"
import { RefreshCw } from "lucide-react"

interface CompletedRound {
  roundId: bigint
  winner: string
  totalAmount: bigint
  randomWinners?: string[]
  winnerAmount?: bigint
  participantAmount?: bigint
  treasuryAmount?: bigint
  timestamp: number
}

export function RoundHistory() {
  const { address: walletAddress } = useAccount()
  const [rounds, setRounds] = useState<CompletedRound[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Helper functions
  const formatAddress = (addr: string) => {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") return "None"
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  // Function to add a new round to the history
  const addRoundToHistory = useCallback((roundData: CompletedRound) => {
    setRounds(prevRounds => {
      // Check if round already exists
      const exists = prevRounds.some(r => r.roundId === roundData.roundId)
      if (exists) return prevRounds
      
      console.log(`📝 Adding Round ${roundData.roundId} to history:`, roundData)
      
      // Add new round and sort by roundId descending
      const newRounds = [roundData, ...prevRounds]
      return newRounds.sort((a, b) => Number(b.roundId) - Number(a.roundId)).slice(0, 10) // Keep last 10 rounds
    })
    setLastRefresh(new Date())
  }, [])

  // Clear history (for testing)
  const clearHistory = useCallback(() => {
    console.log("🧹 Clearing round history")
    setRounds([])
    setLastRefresh(new Date())
  }, [])

  // Set up real-time event listeners
  useEffect(() => {
    let mounted = true
    let roundEndedUnsubscribe: (() => void) | null = null

    console.log("🔌 Setting up round history event listeners...")

    const setupEventListeners = async () => {
      try {
        // Listen for RoundEnded events
        roundEndedUnsubscribe = await watchRoundEndedEvents((roundId, winner, totalAmount) => {
          console.log(`🎉 Round ${roundId} ended! Winner: ${winner}, Prize: ${formatEther(totalAmount)} STT`)
          
          if (mounted) {
            const newRound: CompletedRound = {
              roundId,
              winner,
              totalAmount,
              timestamp: Date.now(),
              // Calculate estimated rewards (70/20/10 split)
              winnerAmount: (totalAmount * BigInt(70)) / BigInt(100), // 70%
              participantAmount: (totalAmount * BigInt(20)) / BigInt(100), // 20%
              treasuryAmount: (totalAmount * BigInt(10)) / BigInt(100), // 10%
              // randomWinners will be updated when RewardsDistributed event fires
            }
            addRoundToHistory(newRound)
          }
        })
        
        console.log("✅ Round history event listeners set up successfully")
        
      } catch (err) {
        console.error("❌ Failed to set up round history event listeners:", err)
      }
    }

    setupEventListeners()

    return () => {
      console.log("🔌 Cleaning up round history event listeners")
      mounted = false
      if (roundEndedUnsubscribe) {
        roundEndedUnsubscribe()
      }
    }
  }, [addRoundToHistory])

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Round History</h3>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {rounds.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              🎲 No completed rounds yet.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Round history will appear here automatically when rounds end.
            </p>
          </div>
        ) : (
          rounds.map((round: CompletedRound) => {
            const isWinner = walletAddress && round.winner?.toLowerCase() === walletAddress.toLowerCase()
            const isRandomWinner = walletAddress && round.randomWinners?.some(
              (addr: string) => addr?.toLowerCase() === walletAddress.toLowerCase()
            )
            
            return (
              <div
                key={round.roundId.toString()}
                className={`p-4 bg-background rounded border ${isWinner ? 'border-green-500 bg-green-50/30' : 'border-border'}`}
              >
                {/* Round Header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-foreground">
                    Round #{round.roundId.toString()}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatTimeAgo(round.timestamp)}
                  </span>
                </div>
                
                {/* Winner Info */}
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">🏆 Winner:</span>{" "}
                    <span className="font-mono text-green-600 font-bold" title={round.winner}>
                      {formatAddress(round.winner)}
                    </span>
                    {isWinner && (
                      <span className="ml-2 px-2 py-0.5 rounded bg-green-600 text-white text-xs font-bold">
                        You Won! 🎉
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm">
                    <span className="font-medium">💰 Total Prize:</span>{" "}
                    <span className="font-bold text-accent">
                      {formatEther(round.totalAmount)} STT
                    </span>
                  </div>
                  
                  {/* Reward Breakdown */}
                  {round.winnerAmount && (
                    <div className="text-xs space-y-1 mt-2 p-2 bg-muted rounded">
                      <div>
                        <span className="font-medium">🏆 Winner Share (70%):</span>{" "}
                        <span className="text-green-600 font-bold">
                          {formatEther(round.winnerAmount)} STT
                        </span>
                      </div>
                      
                      <div>
                        <span className="font-medium">🎲 Random Participants (20%):</span>{" "}
                        <span className="text-blue-600 font-bold">
                          {formatEther(round.participantAmount || BigInt(0))} STT
                        </span>
                      </div>
                      
                      <div>
                        <span className="font-medium">🏛️ Treasury (10%):</span>{" "}
                        <span className="text-yellow-600 font-bold">
                          {formatEther(round.treasuryAmount || BigInt(0))} STT
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Random Winners (when available) */}
                  {round.randomWinners && round.randomWinners.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium">🎲 Random Winners (20% share):</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {round.randomWinners.map((addr: string, i: number) => (
                          <span
                            key={i}
                            className={`text-xs px-2 py-1 rounded font-mono ${
                              walletAddress && addr?.toLowerCase() === walletAddress.toLowerCase()
                                ? 'bg-blue-100 text-blue-700 font-bold border border-blue-300'
                                : 'bg-muted text-muted-foreground'
                            }`}
                            title={addr}
                          >
                            {formatAddress(addr)}
                          </span>
                        ))}
                      </div>
                      {isRandomWinner && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">
                          You're a Random Winner! 🎲
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Status */}
                  {!round.randomWinners || round.randomWinners.length === 0 ? (
                    <div className="text-xs text-orange-600 mt-2">
                      ⏳ Waiting for rewards distribution...
                    </div>
                  ) : (
                    <div className="text-xs text-green-600 mt-2">
                      ✅ Rewards distributed
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
