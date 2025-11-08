"use client"
"use client"
import React from "react"
import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { formatEther } from "@/lib/format-utils"
import { fetchRecentRounds } from "@/lib/contract-service"

interface RoundRecord {
  roundId: bigint;
  winner: string;
  totalAmount: bigint;
  stakersCount?: number;
  stakers?: string[];
  timestamp: number;
  rewards?: {
    winnerAmount: bigint;
    participantAmount: bigint;
    treasuryAmount: bigint;
    randomWinners: string[];
  };
}

interface RoundApiResponse {
  roundId: string | bigint;
  winner: string;
  totalAmount: string | bigint;
  stakersCount?: number;
  stakers?: string[];
  timestamp: number;
  rewards?: {
    winnerAmount?: string | bigint;
    participantAmount?: string | bigint;
    treasuryAmount?: string | bigint;
    randomWinners?: string[];
    // Legacy fields for backward compatibility
    rewardPerWinner?: string | bigint;
  };
  winnerAmount?: string | bigint;
}

export function RoundHistory() {
  const { address: walletAddress } = useAccount()
  const [rounds, setRounds] = useState<RoundRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      try {
        const recent = await fetchRecentRounds(10)
        if (!mounted) return
        if (recent && recent.length > 0) {
          setRounds(
            recent.map((r: any) => {
              const total = BigInt(r.totalAmount ?? 0)
              let winnerAmount = BigInt(0)
              let participantAmount = BigInt(0)
              let treasuryAmount = BigInt(0)
              let randomWinners: string[] = []
              let stakers: string[] = Array.isArray(r.stakers) ? r.stakers : []
              
              // Handle the new rewards structure from fetchRecentRounds
              if (r.rewards) {
                // Use direct values from the improved fetchRecentRounds
                winnerAmount = BigInt(r.rewards.winnerAmount ?? 0)
                participantAmount = BigInt(r.rewards.participantAmount ?? 0)
                treasuryAmount = BigInt(r.rewards.treasuryAmount ?? 0)
                randomWinners = Array.isArray(r.rewards.randomWinners) ? r.rewards.randomWinners : []
              } else {
                // Fallback calculation if no rewards data available
                winnerAmount = (total * BigInt(70)) / BigInt(100)
                participantAmount = (total * BigInt(20)) / BigInt(100)
                treasuryAmount = (total * BigInt(10)) / BigInt(100)
                randomWinners = []
              }
              
              return {
                roundId: BigInt(r.roundId ?? 0),
                winner: String(r.winner ?? "0x0000000000000000000000000000000000000000"),
                totalAmount: total,
                stakersCount: Number(r.stakersCount ?? stakers.length ?? 0),
                stakers,
                timestamp: Number(r.timestamp ?? Date.now()),
                rewards: {
                  winnerAmount,
                  participantAmount,
                  treasuryAmount,
                  randomWinners,
                },
              }
            })
          )
        }
      } catch (err) {
        if (mounted) {
          setError("Failed to load rounds")
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }
    // Add interval or cleanup if needed
    load();
    return () => { mounted = false }
  }, [])

  // Helper functions
  function formatAddress(addr: string) {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") return "None";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  function formatTimeAgo(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-sm text-muted-foreground text-center py-8">Loading round history...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-sm text-red-600 text-center py-8">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold">Round History</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto" role="region" aria-label="Round history list">
        {rounds.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No completed rounds yet</p>
          </div>
        ) : (
          rounds.map((round: RoundRecord, idx: number) => {
            const hasRewards = round.rewards && round.rewards.randomWinners && round.rewards.randomWinners.length > 0;
            const isWinner = walletAddress && round.winner?.toLowerCase() === walletAddress.toLowerCase();
            const isRandomWinner = walletAddress && round.rewards?.randomWinners?.some(
              addr => addr?.toLowerCase() === walletAddress.toLowerCase()
            );
            const claimStatus = isWinner ? "Pending" : "N/A";
            return (
              <React.Fragment key={round.roundId.toString()}>
                <div
                  className={`p-3 bg-background rounded border border-border ${isWinner ? 'border-green-500 bg-green-50/30' : ''}`}
                  role="article"
                  aria-label={`Round ${round.roundId.toString()}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{`Round #${round.roundId.toString()}`}</span>
                    <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">
                      {round.stakersCount} stakers
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">{formatTimeAgo(round.timestamp)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Winner:</span>{" "}
                    <span className="font-mono" title={round.winner}>
                      {formatAddress(round.winner)}
                    </span>
                    {isWinner ? (
                      <span className="ml-2 px-2 py-0.5 rounded bg-green-600 text-white text-xs font-bold">You Won 🎉</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-accent font-semibold">
                    Prize: {formatEther(round.totalAmount)} STT
                  </div>
                  {/* Show all participants/stakers */}
                  {Array.isArray(round.stakers) && round.stakers.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-foreground">
                        All Participants ({round.stakers.length}):
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {round.stakers.slice(0, 15).map((staker, i) => (
                          <span
                            key={i}
                            className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                              staker.toLowerCase() === round.winner?.toLowerCase()
                                ? 'bg-green-100 text-green-700 font-bold border border-green-300'
                                : walletAddress && staker.toLowerCase() === walletAddress.toLowerCase()
                                ? 'bg-blue-100 text-blue-700 font-semibold border border-blue-300'
                                : 'bg-muted text-muted-foreground'
                            }`}
                            title={staker}
                          >
                            {formatAddress(staker)}
                            {staker.toLowerCase() === round.winner?.toLowerCase() ? ' 👑' : ''}
                          </span>
                        ))}
                        {round.stakers.length > 15 && (
                          <span className="text-xs text-muted-foreground px-2 py-0.5">
                            +{round.stakers.length - 15} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {hasRewards ? (
                    <div className="mt-2 text-xs space-y-1">
                      <div>
                        <span className="font-medium">Winner Reward:</span>{" "}
                        <span className="text-green-600 font-bold">
                          {formatEther(round.rewards?.winnerAmount ?? BigInt(0))} STT
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Random Participants:</span>{" "}
                        <span className="text-blue-600 font-bold">
                          {formatEther(round.rewards?.participantAmount ?? BigInt(0))} STT
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Treasury:</span>{" "}
                        <span className="text-yellow-600 font-bold">
                          {formatEther(round.rewards?.treasuryAmount ?? BigInt(0))} STT
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="font-medium">Random Winners:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {round.rewards?.randomWinners?.map((addr, i) => (
                            <span
                              key={i}
                              className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                                walletAddress && addr?.toLowerCase() === walletAddress.toLowerCase()
                                  ? 'bg-blue-100 text-blue-700 font-bold'
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
                      <div className="text-xs text-green-700 mt-1 font-medium">✓ Rewards distributed</div>
                      {isWinner && (
                        <div className="text-xs text-yellow-700">
                          <span className="font-medium">Claim Status:</span> {claimStatus}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs space-y-1">
                      <div className="text-xs text-orange-600 font-medium">
                        ⚠️ Reward distribution event missing or not yet processed.
                      </div>
                      {isWinner && (
                        <div className="text-xs text-yellow-700">
                          You won, but rewards are not distributed yet. Please wait or contact admin.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  )
}