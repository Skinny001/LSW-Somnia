"use client"
import React, { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { formatEther } from "@/lib/format-utils"
import { 
  getNetworkStats, 
  getTopPlayers, 
  subscribeToNetworkEvents, 
  getSDKStatus,
  type NetworkStats,
  type NetworkActivity,
  type TopPlayer
} from "@/lib/somnia-sdk"
import { Button } from "./ui/button"
import { RefreshCw, Activity, TrendingUp, Users, Trophy } from "lucide-react"

export function NetworkInsights() {
  const { address: walletAddress } = useAccount()
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    activeGames: 0,
    onlinePlayers: 0,
    totalPrizePool: BigInt(0),
    stakesPerMinute: 0
  })
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const sdkStatus = getSDKStatus()

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

  // Refresh all data
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [stats, players] = await Promise.all([
        getNetworkStats(),
        getTopPlayers()
      ])
      
      setNetworkStats(stats)
      setTopPlayers(players)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to refresh network data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Set up subscriptions and initial data load
  useEffect(() => {
    let mounted = true

    const setupNetworkInsights = async () => {
      // Load initial data
      await refreshData()
    }

    setupNetworkInsights()

    // Refresh stats periodically
    const statsInterval = setInterval(() => {
      if (mounted) {
        refreshData()
      }
    }, 30000) // Refresh every 30 seconds

    return () => {
      mounted = false
      clearInterval(statsInterval)
    }
  }, [refreshData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Network Insights
          </h3>
          <p className="text-sm text-muted-foreground">
            Live data from Somnia LSW network • Powered by Somnia Data Streams SDK
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* SDK Status */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${sdkStatus.isAvailable ? 'bg-green-500' : 'bg-orange-500'}`} />
            <span className="text-sm font-medium">
              Somnia Data Streams SDK: {sdkStatus.isAvailable ? 'Connected' : 'Demo Mode'}
            </span>
          </div>
          {!sdkStatus.isAvailable && sdkStatus.error && (
            <span className="text-xs text-orange-600">
              {sdkStatus.error}
            </span>
          )}
        </div>
      </div>

      {/* Network Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold">{networkStats.activeGames}</div>
          <div className="text-sm text-muted-foreground">Active Games</div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold">{networkStats.onlinePlayers}</div>
          <div className="text-sm text-muted-foreground">Online Players</div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold">{formatEther(networkStats.totalPrizePool)}</div>
          <div className="text-sm text-muted-foreground">Total Prize Pool</div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold">{networkStats.stakesPerMinute}</div>
          <div className="text-sm text-muted-foreground">Stakes/Min</div>
        </div>
      </div>

      {/* Last Winner Highlight */}
      {networkStats.lastWinner && (
        <div className="bg-linear-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-green-500" />
            <span className="font-semibold text-green-600">Latest Network Winner</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-sm">
                {formatAddress(networkStats.lastWinner.address)}
              </div>
              <div className="text-xs text-muted-foreground">
                Round #{networkStats.lastWinner.roundId} • {formatTimeAgo(networkStats.lastWinner.timestamp)}
              </div>
            </div>
            {walletAddress?.toLowerCase() === networkStats.lastWinner.address.toLowerCase() && (
              <div className="px-2 py-1 bg-green-600 text-white text-xs rounded font-bold">
                That's You! 🎉
              </div>
            )}
          </div>
        </div>
      )}

      {/* Network Leaderboard - This is the unique content */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Network Leaderboard
        </h4>
        <div className="space-y-2">
          {topPlayers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Loading leaderboard...</p>
            </div>
          ) : (
            topPlayers.slice(0, 10).map((player, index) => {
              const isCurrentUser = walletAddress?.toLowerCase() === player.address.toLowerCase()
              
              return (
                <div
                  key={player.address}
                  className={`flex items-center justify-between p-2 rounded border text-sm ${
                    isCurrentUser ? 'bg-blue-50/30 border-blue-300' : 'bg-background'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-mono text-xs">
                        {formatAddress(player.address)}
                        {isCurrentUser && (
                          <span className="ml-2 px-1 py-0.5 bg-blue-600 text-white text-xs rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {player.wins} wins • {formatEther(player.totalEarned)} STT earned
                      </div>
                    </div>
                  </div>
                  {player.lastWin && (
                    <div className="text-xs text-muted-foreground">
                      {formatTimeAgo(player.lastWin)}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* SDK Integration Notice */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
        <h5 className="font-semibold text-blue-600 mb-2">Powered by Somnia Data Streams SDK</h5>
        <p className="text-sm text-muted-foreground">
          This dashboard demonstrates real-time blockchain data streaming using the Somnia SDK. 
          All statistics and activity feeds update automatically without manual refresh.
        </p>
        {!sdkStatus.isAvailable && (
          <p className="text-xs text-orange-600 mt-2">
            Currently running in demo mode with simulated data. 
            Full SDK integration will provide live network-wide insights.
          </p>
        )}
      </div>
    </div>
  )
}