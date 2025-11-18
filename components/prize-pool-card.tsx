"use client"

import { formatEther, formatHbar } from "@/lib/format-utils"
import { getNetworkStats, type NetworkStats } from "@/lib/somnia-sdk"
import React, { useState, useEffect } from "react"

interface PrizePoolCardProps {
  totalAmount: bigint
  stakersCount: bigint
  lastStaker: string
}

export function PrizePoolCard({ totalAmount, stakersCount, lastStaker }: PrizePoolCardProps) {
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    activeGames: 0,
    onlinePlayers: 0,
    totalPrizePool: BigInt(0),
    stakesPerMinute: 0
  })
  const [showNetworkData, setShowNetworkData] = useState(false)

  const winnerReward = (totalAmount * BigInt(70)) / BigInt(100)
  const participantReward = (totalAmount * BigInt(20)) / BigInt(100)
  const treasuryReward = (totalAmount * BigInt(10)) / BigInt(100)

  const formatAddress = (addr: string) => {
    if (addr === "0x0000000000000000000000000000000000000000") return "None"
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Fetch network stats periodically
  useEffect(() => {
    let mounted = true
    
    const fetchNetworkStats = async () => {
      try {
        const stats = await getNetworkStats()
        if (mounted) {
          setNetworkStats(stats)
        }
      } catch (error) {
        console.error('Failed to fetch network stats for prize pool:', error)
      }
    }

    fetchNetworkStats()
    
    // Refresh network data every 30 seconds
    const interval = setInterval(() => {
      if (mounted) {
        fetchNetworkStats()
      }
    }, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-accent">Prize Pool</h2>
          <button
            onClick={() => setShowNetworkData(!showNetworkData)}
            className="px-2 py-1 text-foreground text-xs hover:text-accent transition-colors"
          >
            {showNetworkData ? 'Local' : 'SDK Network'}
          </button>
        </div>
        <div className="text-4xl font-bold text-foreground">
          {showNetworkData 
            ? formatHbar(networkStats.totalPrizePool) 
            : formatHbar(totalAmount)
          } STT
        </div>
        {showNetworkData && (
          <p className="text-xs text-muted-foreground">
            Network-wide total across all active games
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-background rounded p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            {showNetworkData ? 'Online Players' : 'Participants'}
          </div>
          <div className="text-2xl font-bold text-foreground">
            {showNetworkData 
              ? networkStats.onlinePlayers.toString()
              : stakersCount.toString()
            }
          </div>
          {showNetworkData && (
            <div className="text-xs text-muted-foreground mt-1">
              {networkStats.activeGames} active games
            </div>
          )}
        </div>
        <div className="bg-background rounded p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            {showNetworkData ? 'Stakes/Min' : 'Last Staker'}
          </div>
          {showNetworkData ? (
            <div>
              <div className="text-2xl font-bold text-foreground">
                {networkStats.stakesPerMinute}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Network activity
              </div>
            </div>
          ) : (
            <div className="text-xs font-mono text-accent">{formatAddress(lastStaker)}</div>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Winner (70%) {showNetworkData && '- SDK Network'}
          </span>
          <span className="font-semibold text-accent">
            {showNetworkData 
              ? formatHbar((networkStats.totalPrizePool * BigInt(70)) / BigInt(100))
              : formatHbar(winnerReward)
            } STT
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Random Participants (20%) {showNetworkData && '- SDK Network'}
          </span>
          <span className="font-semibold text-foreground">
            {showNetworkData 
              ? formatHbar((networkStats.totalPrizePool * BigInt(20)) / BigInt(100))
              : formatHbar(participantReward)
            } STT
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Treasury (10%) {showNetworkData && '- SDK Network'}
          </span>
          <span className="font-semibold text-foreground">
            {showNetworkData 
              ? formatHbar((networkStats.totalPrizePool * BigInt(10)) / BigInt(100))
              : formatHbar(treasuryReward)
            } STT
          </span>
        </div>
        {showNetworkData && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-blue-600">
              📡 Network data powered by Somnia SDK
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
