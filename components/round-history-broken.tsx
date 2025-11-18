"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { formatEther } from "@/lib/format-utils"
import { GameEventEmitters, subscribeToNetworkEvents } from "@/lib/somnia-sdk"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { RefreshCw, History, Trophy, Users, Coins } from "lucide-react"

interface CompletedRound {
  roundId: bigint
  winner: string
  totalAmount: bigint
  timestamp: number
  source?: 'network'
  gameId?: string
  // Winner information (70%)
  winnerAmount?: bigint
  // Random participants information (20%)
  randomWinners?: string[]
  rewardPerWinner?: bigint
  participantAmount?: bigint
  // Treasury information (10%)
  treasuryAmount?: bigint
  // Status tracking
  hasWinnerData?: boolean
  hasParticipantData?: boolean
  isVRFPending?: boolean
  vrfRequestId?: string
}

export function RoundHistory() {
  const { address: walletAddress } = useAccount()
  const [networkRounds, setNetworkRounds] = useState<CompletedRound[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<'history' | 'network'>('history')

  // Helper functions
  const formatAddress = (addr: string) => {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") return "None"
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const isUserRound = (round: CompletedRound) => {
    if (!walletAddress) return false
    const userAddr = walletAddress.toLowerCase()
    return (
      round.winner.toLowerCase() === userAddr ||
      round.randomWinners?.some(addr => addr.toLowerCase() === userAddr)
    )
  }

  // Handle RoundEnded event (fires immediately when startNewRound is called)
  const handleRoundEndedEvent = useCallback(async (roundEndEvent: any) => {
    try {
      console.log("🎯 Processing RoundEnded event for round:", roundEndEvent.roundId)
      
      const roundId = BigInt(roundEndEvent.roundId || 0)
      const winner = roundEndEvent.winner || roundEndEvent.data?.winner || ''
      const totalAmount = BigInt(roundEndEvent.totalAmount || roundEndEvent.data?.totalAmount || 0)
      
      const roundData: CompletedRound = {
        roundId,
        winner,
        totalAmount,
        timestamp: roundEndEvent.timestamp || Date.now(),
        source: 'network',
        gameId: roundEndEvent.contractAddress || roundEndEvent.gameId || 'round-ended',
        randomWinners: [],
        hasWinnerData: false,
        hasParticipantData: false,
        isVRFPending: false
      }
      
      console.log("🎯 Adding initial round from RoundEnded event:", roundData)
      addRoundToHistory(roundData)
      
    } catch (error) {
      console.error("Failed to handle RoundEnded event:", error)
    }
  }, [])

  // Handle LSW RewardsDistributed event (winner + amounts)
  const handleLSWRewardsEvent = useCallback(async (lswEvent: any) => {
    try {
      console.log("💰 Processing LSW RewardsDistributed event:", lswEvent)
      
      const roundId = BigInt(lswEvent.roundId || 0)
      const winner = lswEvent.winner || lswEvent.data?.winner || ''
      const winnerAmount = lswEvent.winnerAmount ? BigInt(lswEvent.winnerAmount) : undefined
      const participantAmount = lswEvent.participantAmount ? BigInt(lswEvent.participantAmount) : undefined
      const treasuryAmount = lswEvent.treasuryAmount ? BigInt(lswEvent.treasuryAmount) : undefined
      
      // Update existing round with winner data
      setNetworkRounds(prevRounds => {
        return prevRounds.map(round => {
          if (round.roundId === roundId) {
            return {
              ...round,
              winner,
              winnerAmount,
              participantAmount,
              treasuryAmount,
              hasWinnerData: true
            }
          }
          return round
        })
      })
      
      console.log("💰 Updated round with LSW rewards data:", { roundId, winner, winnerAmount })
      
    } catch (error) {
      console.error("Failed to handle LSW RewardsDistributed event:", error)
    }
  }, [])

  // Handle Rewarder RewardsDistributed event (random participants)
  const handleRewarderRewardsEvent = useCallback(async (rewarderEvent: any) => {
    try {
      console.log("🎲 Processing Rewarder RewardsDistributed event:", rewarderEvent)
      
      const roundId = BigInt(rewarderEvent.roundId || 0)
      const randomWinners = rewarderEvent.randomWinners || []
      const rewardPerWinner = rewarderEvent.rewardPerWinner ? BigInt(rewarderEvent.rewardPerWinner) : undefined
      
      // Update existing round with participant data
      setNetworkRounds(prevRounds => {
        return prevRounds.map(round => {
          if (round.roundId === roundId) {
            return {
              ...round,
              randomWinners,
              rewardPerWinner,
              hasParticipantData: true,
              isVRFPending: false
            }
          }
          return round
        })
      })
      
      console.log("🎲 Updated round with participant data:", { roundId, randomWinners, rewardPerWinner })
      
    } catch (error) {
      console.error("Failed to handle Rewarder RewardsDistributed event:", error)
    }
  }, [])

  // Handle RandomnessRequested event (VRF started)
  const handleRandomnessRequestedEvent = useCallback(async (vrfEvent: any) => {
    try {
      console.log("🎯 Processing RandomnessRequested event:", vrfEvent)
      
      const roundId = BigInt(vrfEvent.roundId || 0)
      const vrfRequestId = vrfEvent.vrfRequestId || vrfEvent.requestId
      
      // Update existing round to show VRF is pending
      setNetworkRounds(prevRounds => {
        return prevRounds.map(round => {
          if (round.roundId === roundId) {
            return {
              ...round,
              isVRFPending: true,
              vrfRequestId
            }
          }
          return round
        })
      })
      
      console.log("🎯 Updated round with VRF pending status:", { roundId, vrfRequestId })
      
    } catch (error) {
      console.error("Failed to handle RandomnessRequested event:", error)
    }
  }, [])

  // Convert RewardsDistributed event to round format
  const convertRewardsDistributedToRound = useCallback(async (rewardsEvent: any): Promise<CompletedRound | null> => {
    if (!rewardsEvent || rewardsEvent.type !== 'roundWon') return null

    try {
      // Extract round ID from the event
      const roundId = BigInt(rewardsEvent.roundId || 0)
      
      console.log(`🏆 RewardsDistributed event received for round ${roundId}, fetching complete round data...`)
      
      // Fetch complete round data from contract history
      const { fetchRecentRounds } = await import("@/lib/contract-service")
      const recentRounds = await fetchRecentRounds(5) // Get last 5 rounds
      
      // Find the specific round that just completed
      const completedRound = recentRounds.find(round => round.roundId === roundId)
      
      if (!completedRound) {
        console.warn(`Round ${roundId} not found in recent rounds data`)
        return null
      }

      // Convert contract round data to our format
      const roundData: CompletedRound = {
        roundId: completedRound.roundId,
        winner: completedRound.winner,
        totalAmount: completedRound.totalAmount,
        timestamp: completedRound.timestamp || Date.now(),
        source: 'network',
        gameId: rewardsEvent.contractAddress || rewardsEvent.gameId,
        randomWinners: completedRound.rewards?.randomWinners || [],
        winnerAmount: completedRound.rewards?.winnerAmount,
        participantAmount: completedRound.rewards?.participantAmount,
        treasuryAmount: completedRound.rewards?.treasuryAmount
      }

      console.log("🏆 Successfully converted RewardsDistributed to complete round data:", roundData)
      return roundData
      
    } catch (error) {
      console.error("Failed to fetch complete round data for RewardsDistributed event:", error)
      
      // Fallback: create basic round data from event
      const roundId = BigInt(rewardsEvent.roundId || 0)
      const randomWinners = rewardsEvent.randomWinners || []
      const rewardPerWinner = rewardsEvent.rewardPerWinner ? BigInt(rewardsEvent.rewardPerWinner) : BigInt(0)
      const treasuryAmount = rewardsEvent.treasuryAmount ? BigInt(rewardsEvent.treasuryAmount) : BigInt(0)
      
      const participantAmount = rewardPerWinner * BigInt(randomWinners.length)
      const winnerAmount = (participantAmount * BigInt(70)) / BigInt(20)
      const totalAmount = winnerAmount + participantAmount + treasuryAmount

      return {
        roundId,
        winner: "Round Completed", // Fallback when we can't fetch winner
        totalAmount,
        timestamp: rewardsEvent.timestamp || Date.now(),
        source: 'network',
        gameId: rewardsEvent.contractAddress || rewardsEvent.gameId,
        randomWinners,
        winnerAmount,
        participantAmount,
        treasuryAmount
      }
    }
  }, [])

  // Add round to network history (SDK events only)
  const addRoundToHistory = useCallback((roundData: CompletedRound) => {
    setNetworkRounds(prevRounds => {
      // Check if round already exists
      const exists = prevRounds.some(r => 
        r.roundId === roundData.roundId && r.gameId === roundData.gameId
      )
      if (exists) return prevRounds
      
      console.log(`📺 Adding Network Round ${roundData.roundId} to SDK history:`, roundData)
      
      // Add new round and sort by timestamp descending
      const newRounds = [roundData, ...prevRounds]
      return newRounds.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
    })
    setLastRefresh(new Date())
  }, [])

  // Clear history (for testing)
  const clearHistory = useCallback(() => {
    console.log("🧹 Clearing network round history")
    setNetworkRounds([])
    setLastRefresh(new Date())
  }, [])

  // Load initial historical data on mount
  useEffect(() => {
    let mounted = true

    const loadInitialHistory = async () => {
      try {
        console.log("📚 Loading initial round history from contract...")
        const { fetchRecentRounds } = await import("@/lib/contract-service")
        const historicalRounds = await fetchRecentRounds(10) // Get last 10 rounds
        
        if (mounted && historicalRounds.length > 0) {
          console.log(`📚 Found ${historicalRounds.length} historical rounds:`, historicalRounds)
          
          // Convert contract rounds to our format
          const convertedRounds = historicalRounds.map((round: any): CompletedRound => ({
            roundId: round.roundId,
            winner: round.winner,
            totalAmount: round.totalAmount,
            timestamp: round.timestamp,
            source: 'network',
            gameId: 'contract-history',
            randomWinners: round.rewards?.randomWinners || [],
            winnerAmount: round.rewards?.winnerAmount,
            participantAmount: round.rewards?.participantAmount,
            treasuryAmount: round.rewards?.treasuryAmount
          }))
          
          setNetworkRounds(convertedRounds)
          setLastRefresh(new Date())
          console.log(`✅ Loaded ${convertedRounds.length} historical rounds into Round History`)
        } else {
          console.log("📚 No historical rounds found")
        }
      } catch (error) {
        console.error("❌ Failed to load initial round history:", error)
      }
    }

    loadInitialHistory()

    return () => {
      mounted = false
    }
  }, []) // Run once on mount

  // Set up contract event listeners for new round completions
  useEffect(() => {
    let mounted = true
    let contractUnsubscribers: Array<() => void> = []

    console.log("🔌 Setting up direct contract event listeners for Round History...")

    const setupContractEventWatchers = async () => {
      try {
        // Import contract event watchers
        const { watchRoundEndedEvents, watchRewardsDistributedEvents } = await import("@/lib/contract-service")
        
        // 1. Watch for RoundEnded events from LSW contract
        console.log("🔌 Setting up direct RoundEnded contract watcher...")
        const roundEndUnsubscribe = await watchRoundEndedEvents((roundId, winner, totalAmount) => {
          if (mounted) {
            const roundEndEvent = {
              roundId,
              winner,
              totalAmount,
              timestamp: Date.now(),
              contractAddress: process.env.NEXT_PUBLIC_LSW_CONTRACT_ADDRESS,
              source: 'LSW_RoundEnded'
            }
            console.log("🎯 Direct RoundEnded event received:", roundEndEvent)
            handleRoundEndedEvent(roundEndEvent)
          }
        })
        contractUnsubscribers.push(roundEndUnsubscribe)
        console.log("✅ Direct RoundEnded contract watcher active")

        // 2. Listen for LSW RewardsDistributed events (winner amounts)
        console.log("🔌 Setting up LSW RewardsDistributed subscription...")
        lswRewardsUnsubscribe = await subscribeToNetworkEvents('LSWRewardsDistributed', async (lswEvent: any) => {
          if (mounted) {
            console.log("💰 LSW RewardsDistributed event received:", lswEvent)
            await handleLSWRewardsEvent(lswEvent)
          }
        })
        console.log("✅ LSW RewardsDistributed subscription active:", !!lswRewardsUnsubscribe)

        // 3. Listen for Rewarder RewardsDistributed events (random participants)
        console.log("🔌 Setting up Rewarder RewardsDistributed subscription...")
        rewarderRewardsUnsubscribe = await subscribeToNetworkEvents('RewarderRewardsDistributed', async (rewarderEvent: any) => {
          if (mounted) {
            console.log("🎲 Rewarder RewardsDistributed event received:", rewarderEvent)
            await handleRewarderRewardsEvent(rewarderEvent)
          }
        })
        console.log("✅ Rewarder RewardsDistributed subscription active:", !!rewarderRewardsUnsubscribe)

        // 4. Listen for RandomnessRequested events (VRF started)
        console.log("🔌 Setting up RandomnessRequested subscription...")
        randomnessUnsubscribe = await subscribeToNetworkEvents('RandomnessRequested', async (vrfEvent: any) => {
          if (mounted) {
            console.log("🎯 RandomnessRequested event received:", vrfEvent)
            await handleRandomnessRequestedEvent(vrfEvent)
          }
        })
        console.log("✅ RandomnessRequested subscription active:", !!randomnessUnsubscribe)

        console.log("✅ All 4 round history event subscriptions set up successfully")
        console.log("📊 Subscription status summary:", {
          roundEnd: !!roundEndUnsubscribe,
          lswRewards: !!lswRewardsUnsubscribe, 
          rewarderRewards: !!rewarderRewardsUnsubscribe,
          randomness: !!randomnessUnsubscribe
        })

      } catch (error) {
        console.error("❌ Failed to set up round history subscriptions:", error)
      }
    }

    setupSubscriptions()

    return () => {
      console.log("🔌 Cleaning up SDK round history event listeners")
      mounted = false
      if (roundEndUnsubscribe) {
        roundEndUnsubscribe()
      }
      if (lswRewardsUnsubscribe) {
        lswRewardsUnsubscribe()
      }
      if (rewarderRewardsUnsubscribe) {
        rewarderRewardsUnsubscribe()
      }
      if (randomnessUnsubscribe) {
        randomnessUnsubscribe()
      }
    }
  }, [handleRoundEndedEvent, convertRewardsDistributedToRound, addRoundToHistory])

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center bg-muted rounded-lg p-1">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="w-4 h-4" />
            Round History
          </button>
        </div>

        {activeTab === 'history' && (
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-[10px] text-muted-foreground">
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
        )}
      </div>
      
      {/* Tab Content */}
      {activeTab === 'history' ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <div className="rounded p-3 mb-4">
            <p className="text-sm font-medium text-foreground">
              � Completed Rounds via RewardsDistributed Events
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Showing completed rounds when rewards are distributed, including random winners and prize breakdown
            </p>
          </div>

          {networkRounds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                � No completed rounds yet.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Round history will appear here when rewards are distributed via RewardsDistributed events.
              </p>
            </div>
          ) : (
            networkRounds.map((round) => (
              <div
                key={`${round.gameId || 'default'}-${round.roundId}`}
                className={`border rounded-lg p-4 transition-colors ${
                  isUserRound(round) ? 'bg-yellow-50 border-yellow-200' : 'bg-background'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      #{round.roundId.toString()}
                    </Badge>
                    {isUserRound(round) && (
                      <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                        Your Round
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(round.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Winner */}
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Winner</p>
                      <p className="text-sm font-mono">{formatAddress(round.winner)}</p>
                      {round.winnerAmount && (
                        <p className="text-xs text-green-600">
                          {formatEther(round.winnerAmount)} STT
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Total Prize */}
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Total Prize</p>
                      <p className="text-sm font-semibold">
                        {formatEther(round.totalAmount)} STT
                      </p>
                    </div>
                  </div>

                  {/* Random Winners */}
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Random Winners</p>
                      {round.randomWinners && round.randomWinners.length > 0 ? (
                        <div className="space-y-1">
                          {round.randomWinners.slice(0, 2).map((winner, idx) => (
                            <p key={idx} className="text-xs font-mono">
                              {formatAddress(winner)}
                            </p>
                          ))}
                          {round.randomWinners.length > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{round.randomWinners.length - 2} more
                            </p>
                          )}
                          {round.participantAmount && (
                            <p className="text-xs text-green-600">
                              {formatEther(round.participantAmount)} STT shared
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">None</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Network view coming soon...</p>
        </div>
      )}
    </div>
  )
}