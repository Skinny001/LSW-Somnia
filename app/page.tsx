"use client"

import { useContractRead } from "@/hooks/use-contract-read"
import { useState, useEffect } from "react"
import { TimerDisplay } from "@/components/timer-display"
import { PrizePoolCard } from "@/components/prize-pool-card"
import { StakingInterface } from "@/components/staking-interface"
import { ActivityFeed } from "@/components/activity-feed"
import { GameStatus } from "@/components/game-status"
import RoundHistory from "@/components/round-history"
import { WalletButton } from "@/components/wallet-button"
import { useOwnerCheck } from "@/hooks/use-owner-check"
import { Button } from "@/components/ui/button"
import Link from "next/link"


export default function Home() {
  const [stakeAmountUpdated, setStakeAmountUpdated] = useState(0)
  const { roundInfo, timeRemaining, timeUntilStaking, isStakingAvailable, loading, error } = useContractRead()
  const { isOwner, loading: ownerLoading, isConnected } = useOwnerCheck()

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])





  if (!mounted) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 fade-in">
          <div className="text-4xl font-bold text-accent float">Last Staker Wins</div>
          <div className="text-muted-foreground">Loading game data...</div>
        </div>
      </div>
    )
  }

  if (error || !roundInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 fade-in">
          <div className="text-4xl font-bold text-accent">Last Staker Wins</div>
          <div className="text-destructive">{error || "Failed to load game data"}</div>
          <div className="text-sm text-muted-foreground mt-4">Make sure you're connected to Somnia Testnet</div>
        </div>
      </div>
    )
  }

  const isRoundExpired = Number(timeRemaining) === 0

  // Callback to trigger refresh
  const handleStakeAmountUpdate = () => {
    setStakeAmountUpdated(Date.now())
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header - mobile responsive */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out">
              <img 
                src="/LSW-logo.png" 
                alt="LSW Logo" 
                className="w-10 h-10 object-contain rounded-lg"
              />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">Last Staker Wins</h1>
              <p className="text-xs text-muted-foreground">Somnia Testnet</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="text-left sm:text-right w-full sm:w-auto">
              <div className="text-sm text-muted-foreground">Round #{roundInfo.roundId.toString()}</div>
            </div>
            {isOwner && !ownerLoading && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  Admin Panel
                </Button>
              </Link>
            )}
            <div className="w-full sm:w-auto flex flex-row sm:flex-row items-center gap-2">
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - mobile responsive */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Game Status Banner */}
        <div className="slide-in-up">
          <GameStatus
            isActive={roundInfo.isActive}
            isStakingAvailable={isStakingAvailable}
            timeRemaining={timeRemaining}
            timeUntilStaking={timeUntilStaking}
          />
        </div>

        {/* Timer Section */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-8 text-center slide-in-up">
          <TimerDisplay
            timeRemaining={timeRemaining}
            timeUntilStaking={timeUntilStaking}
            isStakingAvailable={isStakingAvailable}
            isActive={roundInfo.isActive}
          />
        </div>

        {/* Main Grid - mobile responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Left Column - Prize Pool */}
          <div className="lg:col-span-1 slide-in-up">
            <PrizePoolCard
              totalAmount={roundInfo.totalAmount}
              stakersCount={roundInfo.stakersCount}
              lastStaker={roundInfo.lastStaker}
            />
          </div>

          {/* Middle Column - Staking */}
          <div className="lg:col-span-1 slide-in-up">
            <StakingInterface
              isStakingAvailable={isStakingAvailable}
              isRoundExpired={isRoundExpired}
              isActive={roundInfo.isActive}
              stakeAmountUpdated={stakeAmountUpdated}
              roundId={roundInfo.roundId}
            />
          </div>

          {/* Right Column - Activity Feed */}
          <div className="lg:col-span-1 slide-in-up">
            <ActivityFeed currentRoundId={roundInfo?.roundId} />
          </div>
        </div>

        {/* Round History Section */}
        <div className="slide-in-up">
          <RoundHistory />
        </div>
      </div>
    </main>
  )
}
