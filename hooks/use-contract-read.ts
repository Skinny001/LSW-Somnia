"use client"

import { useEffect, useState, useCallback } from "react"
import {
  getCurrentRoundInfo,
  getTimeRemaining,
  getTimeUntilStakingAvailable,
  isStakingAvailable,
  getStakeAmount,
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

export function useContractRead(refreshInterval = 1000) {
  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<bigint>(BigInt(0))
  const [timeUntilStaking, setTimeUntilStaking] = useState<bigint>(BigInt(0))
  const [isStakingAvailableState, setIsStakingAvailableState] = useState(false)
  const [stakeAmount, setStakeAmount] = useState<bigint>(BigInt(0))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [round, timeRem, timeUntilStakingStart, stakingAvail, stakeAmt] = await Promise.all([
        getCurrentRoundInfo(),
        getTimeRemaining(),
        getTimeUntilStakingAvailable(),
        isStakingAvailable(),
        getStakeAmount(),
      ])

      setRoundInfo(round)
      setTimeRemaining(timeRem)
      setTimeUntilStaking(timeUntilStakingStart)
      setIsStakingAvailableState(stakingAvail)
      setStakeAmount(stakeAmt)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch contract data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000) // 10 seconds
    return () => clearInterval(interval)
  }, [fetchData])

  return {
    roundInfo,
    timeRemaining,
    timeUntilStaking,
    isStakingAvailable: isStakingAvailableState,
    stakeAmount,
    loading,
    error,
    refetch: fetchData,
  }
}
