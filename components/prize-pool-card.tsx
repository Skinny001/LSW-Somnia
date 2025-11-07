"use client"

import { formatEther, formatHbar } from "@/lib/format-utils"

interface PrizePoolCardProps {
  totalAmount: bigint
  stakersCount: bigint
  lastStaker: string
}

export function PrizePoolCard({ totalAmount, stakersCount, lastStaker }: PrizePoolCardProps) {
  const winnerReward = (totalAmount * BigInt(70)) / BigInt(100)
  const participantReward = (totalAmount * BigInt(20)) / BigInt(100)
  const treasuryReward = (totalAmount * BigInt(10)) / BigInt(100)

  const formatAddress = (addr: string) => {
    if (addr === "0x0000000000000000000000000000000000000000") return "None"
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-accent">Prize Pool</h2>
      <div className="text-4xl font-bold text-foreground">{formatHbar(totalAmount)} STT</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-background rounded p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Participants</div>
          <div className="text-2xl font-bold text-foreground">{stakersCount.toString()}</div>
        </div>
        <div className="bg-background rounded p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Staker</div>
          <div className="text-sm font-mono text-accent">{formatAddress(lastStaker)}</div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Winner (70%)</span>
          <span className="font-semibold text-accent">{formatHbar(winnerReward)} STT</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Random Participants (20%)</span>
          <span className="font-semibold text-foreground">{formatHbar(participantReward)} STT</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Treasury (10%)</span>
          <span className="font-semibold text-foreground">{formatHbar(treasuryReward)} STT</span>
        </div>
      </div>
    </div>
  )
}
