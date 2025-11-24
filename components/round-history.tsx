"use client"

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Trophy, Users, Clock, DollarSign, RefreshCcw } from 'lucide-react'
import { useContractEvents, type RoundEndedEvent } from '@/hooks/use-contract-events'

// Simple interface for completed rounds
export interface CompletedRound {
  roundId: bigint
  winner: string
  totalAmount: bigint
  timestamp: number
  source: string
  gameId: string
}

export default function RoundHistory() {
  const [networkRounds, setNetworkRounds] = useState<CompletedRound[]>([])
  const storageKey = 'lsw-round-history';

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setNetworkRounds(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to load round history from localStorage:', err);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(networkRounds));
    } catch (err) {
      console.warn('Failed to save round history to localStorage:', err);
    }
  }, [networkRounds]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Format wallet address for display
  const formatWalletAddress = useCallback((address: string) => {
    if (!address || address === "Round Completed") return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [])

  // Add round to history when RoundEnded event occurs
  const handleRoundEnded = useCallback((event: RoundEndedEvent) => {
    console.log("🎯 Round ended event received:", event)
    
    // Validate the event data before adding to history
    const isValidRound = event.winner && 
                        event.winner !== '0x0000000000000000000000000000000000000000' && 
                        event.totalAmount && 
                        BigInt(event.totalAmount) > 0
    
    if (!isValidRound) {
      console.log("🚫 Ignoring invalid round event (dummy data):", event)
      return
    }
    
    const roundData: CompletedRound = {
      roundId: event.roundId,
      winner: event.winner,
      totalAmount: event.totalAmount,
      timestamp: event.timestamp,
      source: 'contract-event',
      gameId: `round-${event.roundId}`
    }
    
    console.log("📺 Adding valid completed round to history:", roundData)
    
    setNetworkRounds(prevRounds => {
      // Check if round already exists
      const exists = prevRounds.some(r => r.roundId === roundData.roundId)
      if (exists) {
        console.log("🔄 Round already exists, skipping duplicate")
        return prevRounds
      }
      
      // Add new round and sort by timestamp descending
      const newRounds = [roundData, ...prevRounds]
      return newRounds.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
    })
    
    setLastRefresh(new Date())
  }, [])

  // Use the existing contract events hook
  useContractEvents(
    undefined, // onStake
    undefined, // onRoundStarted
    handleRoundEnded // onRoundEnded
  )

  // Load initial historical data on mount (DISABLED - only load via manual refresh)
  useEffect(() => {
    console.log("📚 Round History mounted - will only show new rounds from contract events")
    console.log("📚 Use 'Refresh' button to manually load historical data")
    
    // Component starts clean - no automatic historical data loading
    // This prevents showing dummy/empty rounds on startup
    
    return () => {
      // Cleanup if needed
    }
  }, []) // Run once on mount

  // Clear history (for testing)
  const clearHistory = useCallback(() => {
    console.log("🧹 Clearing round history")
    setNetworkRounds([])
    setLastRefresh(new Date())
    try {
      localStorage.removeItem(storageKey);
    } catch (err) {
      console.warn('Failed to clear round history from localStorage:', err);
    }
  }, [])

  // Refresh history
  const refreshHistory = useCallback(async () => {
    try {
      console.log("🔄 Refreshing round history...")
      const { fetchRecentRounds } = await import("@/lib/contract-service")
      const historicalRounds = await fetchRecentRounds(10)
      
      console.log("🔄 Raw refresh data:", historicalRounds)
      
      // Filter out empty/dummy rounds
      const validRounds = historicalRounds.filter((round: any) => {
        const isValid = round.winner && 
                       round.winner !== '0x0000000000000000000000000000000000000000' && 
                       round.totalAmount && 
                       BigInt(round.totalAmount) > 0
        
        if (!isValid) {
          console.log(`🚫 Filtering out invalid refresh round:`, round)
        }
        return isValid
      })
      
      const convertedRounds = validRounds.map((round: any): CompletedRound => ({
        roundId: round.roundId,
        winner: round.winner,
        totalAmount: round.totalAmount,
        timestamp: round.timestamp,
        source: 'contract-refresh',
        gameId: `refresh-${round.roundId}`
      }))
      
      setNetworkRounds(convertedRounds)
      try {
        localStorage.setItem(storageKey, JSON.stringify(convertedRounds));
      } catch (err) {
        console.warn('Failed to save refreshed round history to localStorage:', err);
      }
      setLastRefresh(new Date())
      console.log(`✅ Refreshed with ${convertedRounds.length} valid rounds`)
    } catch (error) {
      console.error("❌ Failed to refresh history:", error)
    }
  }, [])

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Round History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshHistory}
              className="flex items-center gap-1"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearHistory}
              className="text-red-600 hover:text-red-700"
            >
              Clear
            </Button>
            {/* <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                const { fetchRecentRounds } = await import("@/lib/contract-service")
                const raw = await fetchRecentRounds(5)
                console.log("🔍 Raw contract data:", raw)
                alert(`Found ${raw.length} rounds. Check console for details.`)
              }}
              className="text-blue-600"
            >
              Debug
            </Button> */}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total Rounds: {networkRounds.length}</span>
          <span>Last Updated: {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {networkRounds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="mx-auto h-12 w-12 opacity-50 mb-3" />
            <p className="text-lg font-medium">No completed rounds yet</p>
            <p className="text-sm">Round history will appear here when rounds are completed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {networkRounds.map((round) => (
              <div
                key={`${round.gameId}-${round.roundId}`}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-mono">
                      #{round.roundId.toString()}
                    </Badge>
                    <div className="flex items-center gap-1 text-green-600">
                      <Trophy className="h-4 w-4" />
                      <span className="font-medium">Round Won</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(round.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Winner:</span>
                      <span className="font-mono text-sm">
                        {formatWalletAddress(round.winner)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Prize Pool:</span>
                      <span className="font-bold text-green-600">
                        {(Number(round.totalAmount) / 1e18).toFixed(4)} STT
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-xs text-muted-foreground">
                      Source: {round.source}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <Separator className="my-4" />
        
        <div className="text-xs text-muted-foreground text-center">
          Showing most recent completed rounds • Updates automatically via contract events
        </div>
      </CardContent>
    </Card>
  )
}