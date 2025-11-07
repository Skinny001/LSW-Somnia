"use client"

import { useState, useCallback } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { LSW_CONTRACT_ADDRESS, MINIMUM_STAKE } from "@/lib/somnia-config"
import { LSW_ABI } from "@/lib/contract-abi"
import { parseEther } from "viem"; 

export function useContractWrite() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending, data: hash, error: writeError } = useWriteContract()
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash })
  const [error, setError] = useState<string | null>(null)

  const executeStake = useCallback(async (value?: bigint) => {
    setError(null)

    if (!isConnected || !address) {
      setError("Wallet not connected. Please connect your wallet first.")
      return null
    }


    try {
      writeContract({
        address: LSW_CONTRACT_ADDRESS as `0x${string}`,
        abi: LSW_ABI,
        functionName: "stake",
        // value is expected in the chain native smallest unit (wei-like). We
        // assume callers pass `value` already in 18-decimal units (STT wei).
        value: value !== undefined ? value : BigInt(0),
        account: address,
      })
      console.log("reach here")
      return hash
    } catch (err) {
      console.log("Stake error:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to execute stake"
      setError(errorMessage)
      return null
    }
  }, [isConnected, address, writeContract, hash])

  const executeStartNewRound = useCallback(async () => {
    setError(null)

    if (!isConnected || !address) {
      setError("Wallet not connected. Please connect your wallet first.")
      return null
    }

    try {
      writeContract({
        address: LSW_CONTRACT_ADDRESS as `0x${string}`,
        abi: LSW_ABI,
        functionName: "startNewRound",
        account: address,
      })
      return hash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start new round"
      setError(errorMessage)
      return null
    }
  }, [isConnected, address, writeContract, hash])

  const executeEmergencyWithdraw = useCallback(async () => {
    setError(null)
    if (!isConnected || !address) {
      setError("Wallet not connected. Please connect your wallet first.")
      return null
    }
    try {
      writeContract({
        address: LSW_CONTRACT_ADDRESS as `0x${string}`,
        abi: LSW_ABI,
        functionName: "emergencyWithdraw",
        account: address,
      })
      return hash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to execute emergency withdraw"
      setError(errorMessage)
      return null
    }
  }, [isConnected, address, writeContract, hash])

  const executeUpdateStakeAmount = useCallback(async (amount: bigint) => {
    setError(null)
    if (!isConnected || !address) {
      setError("Wallet not connected. Please connect your wallet first.")
      return null
    }
    try {
      writeContract({
        address: LSW_CONTRACT_ADDRESS as `0x${string}`,
        abi: LSW_ABI,
        functionName: "updateStakeAmount",
        args: [amount],
        account: address,
      })
      return hash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update stake amount"
      setError(errorMessage)
      return null
    }
  }, [isConnected, address, writeContract, hash])

  const executeUpdateBufferSettings = useCallback(async (stakeBuffer: number, bufferDelay: number) => {
    setError(null)
    if (!isConnected || !address) {
      setError("Wallet not connected. Please connect your wallet first.")
      return null
    }
    try {
      writeContract({
        address: LSW_CONTRACT_ADDRESS as `0x${string}`,
        abi: LSW_ABI,
        functionName: "updateBufferSettings",
        args: [BigInt(stakeBuffer), BigInt(bufferDelay)],
        account: address,
      })
      return hash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update buffer settings"
      setError(errorMessage)
      return null
    }
  }, [isConnected, address, writeContract, hash])

  const executeUpdateStakingWaitPeriod = useCallback(async (stakingWaitPeriod: bigint) => {
    setError(null)
    if (!isConnected || !address) {
      setError("Wallet not connected. Please connect your wallet first.")
      return null
    }
    try {
      writeContract({
        address: LSW_CONTRACT_ADDRESS as `0x${string}`,
        abi: LSW_ABI,
        functionName: "updateStakingWaitPeriod",
        args: [stakingWaitPeriod],
        account: address,
      })
      return hash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update staking wait period"
      setError(errorMessage)
      return null
    }
  }, [isConnected, address, writeContract, hash])

  return {
    executeStake,
    executeStartNewRound,
    executeEmergencyWithdraw,
    executeUpdateStakeAmount,
    executeUpdateBufferSettings,
    executeUpdateStakingWaitPeriod,
    isLoading: isPending || isWaiting,
    error: error || (writeError ? writeError.message : null),
    hash: hash ? hash.toString() : null,
    isConnected,
    address,
  }
}
