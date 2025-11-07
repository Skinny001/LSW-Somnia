"use client"

import { useEffect, useState } from "react"
import {
  getCurrentRoundInfo,
  getTimeRemaining,
  getTimeUntilStakingAvailable,
  isStakingAvailable,
} from "@/lib/contract-service"

export interface RoundInfo {
  roundId: bigint
  lastStaker: string
  totalAmount: bigint
  deadline: bigint
  isActive: boolean
  stakersCount: bigint
  stakingAvailableAt: bigint
}

export function useRoundInfo() {
  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<bigint>(BigInt(0))
  const [timeUntilStaking, setTimeUntilStaking] = useState<bigint>(BigInt(0))
  const [isStakingAvailableState, setIsStakingAvailableState] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRoundInfo = async () => {
      try {
        const [roundData, timeRem, timeUntilStakingStart, stakingAvail] = await Promise.all([
          getCurrentRoundInfo(),
          getTimeRemaining(),
          getTimeUntilStakingAvailable(),
          isStakingAvailable(),
        ])

        setRoundInfo(roundData)
        setTimeRemaining(timeRem)
        setTimeUntilStaking(timeUntilStakingStart)
        setIsStakingAvailableState(stakingAvail)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch round info")
      } finally {
        setLoading(false)
      }
    }

    fetchRoundInfo()
    const interval = setInterval(fetchRoundInfo, 1000)

    return () => clearInterval(interval)
  }, [])

  return {
    roundInfo,
    timeRemaining,
    timeUntilStaking,
    isStakingAvailable: isStakingAvailableState,
    loading,
    error,
  }
}
