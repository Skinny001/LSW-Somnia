"use client"

import { useState, useEffect } from "react"
import { useContractWrite } from "@/hooks/use-contract-write"
import { useWaitForTransactionReceipt } from "wagmi"
import { Button } from "@/components/ui/button"
import { formatEther, formatHbar} from "@/lib/format-utils"
import { MINIMUM_STAKE } from "@/lib/somnia-config"
import { GameEventEmitters } from "@/lib/somnia-sdk"

interface StakingInterfaceProps {
  isStakingAvailable: boolean
  isRoundExpired: boolean
  isActive: boolean
  stakeAmountUpdated?: number
  roundId?: bigint
}

export function StakingInterface({ isStakingAvailable, isRoundExpired, isActive, stakeAmountUpdated, roundId }: StakingInterfaceProps) {
  const { executeStake, executeStartNewRound, isLoading, error, hash, isConnected, address } = useContractWrite()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showWalletPrompt, setShowWalletPrompt] = useState(false)
  const [isAmountValid, setIsAmountValid] = useState<boolean>(true)
  const [minimumStake, setMinimumStake] = useState<bigint>(MINIMUM_STAKE)
  const [pendingStakeAmount, setPendingStakeAmount] = useState<bigint | null>(null)
  
  // Wait for transaction confirmation
  const { 
    data: receipt, 
    isSuccess: isConfirmed,
    isLoading: isConfirming 
  } = useWaitForTransactionReceipt({
    hash: hash as `0x${string}` | undefined,
  })
  // Fetch minimum stake from contract on mount and when round changes
  useEffect(() => {
    let mounted = true
    async function fetchStakeAmount() {
      try {
        const { getStakeAmount } = await import("@/lib/contract-service")
        const stakeAmt = await getStakeAmount()
        if (mounted) {
          setMinimumStake(stakeAmt)
        }
      } catch {}
    }
    fetchStakeAmount()
    return () => { mounted = false }
  }, [isActive, isRoundExpired, stakeAmountUpdated])

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && receipt && pendingStakeAmount && address && roundId) {
      console.log("✅ Transaction confirmed! Adding stake activity to feed")
      
      // Add confirmed activity to feed
      if (typeof window !== 'undefined' && (window as any).addStakeActivity) {
        console.log('⚡ Adding confirmed stake activity for:', address)
        ;(window as any).addStakeActivity(address, pendingStakeAmount, roundId)
      }
      
      // Emit SDK event for network insights (non-blocking)
      console.log('🚀 Emitting playerStaked SDK event:', {
        address,
        roundId: roundId.toString(),
        amount: pendingStakeAmount.toString()
      })
      GameEventEmitters.playerStaked(
        address,
        roundId.toString(),
        pendingStakeAmount
      ).then(() => {
        console.log('✅ SDK playerStaked event emitted successfully')
      }).catch(err => {
        console.error("❌ SDK event emission failed:", err)
      })
      
      // Clear pending state and show success
      setPendingStakeAmount(null)
      setSuccessMessage(`Stake confirmed! Amount: ${formatHbar(pendingStakeAmount)} STT`)
    }
  }, [isConfirmed, receipt, pendingStakeAmount, address, roundId])
  
  // Separate effect to handle success message timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    if (hash && !isConfirmed) {
      setSuccessMessage(`Transaction submitted: ${hash.slice(0, 10)}... Waiting for confirmation`)
      const timer = setTimeout(() => setSuccessMessage(null), 10000)
      return () => clearTimeout(timer)
    }
  }, [hash, isConfirmed])

  useEffect(() => {
    if (error) {
      setLocalError(error)
      const timer = setTimeout(() => setLocalError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleStake = async () => {
    // Automatically stake the contract's fetched minimum amount
    if (!isConnected) {
      setShowWalletPrompt(true)
      setLocalError("Please connect your wallet to stake")
      console.log("Stake failed: wallet not connected")
      return
    }
    if (!minimumStake) {
      setLocalError("Stake amount not available")
      console.log("Stake failed: minimum stake not loaded")
      return
    }
    setLocalError(null)
    setSuccessMessage(null)
    
    // Store the stake amount for when transaction confirms
    setPendingStakeAmount(minimumStake)
    
    try {
      const result = await executeStake(minimumStake)
      console.log("Stake transaction submitted:", result)
      console.log("⏳ Waiting for transaction confirmation before adding activity...")
    } catch (err) {
      console.log("Stake transaction error:", err)
      setPendingStakeAmount(null) // Clear pending state on error
    }
  }

  const handleStartNewRound = async () => {
    if (!isConnected) {
      setShowWalletPrompt(true)
      setLocalError("Please connect your wallet to start a new round")
      return
    }
    setLocalError(null)
    setSuccessMessage(null)
    await executeStartNewRound()
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="space-y-2">
  <h3 className="text-lg font-semibold">Stake STT</h3>
  <p className="text-sm text-muted-foreground">Minimum stake: {formatHbar(minimumStake)} STT</p>
        {isConnected && address && (
          <p className="text-xs text-accent">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        )}
      </div>
      {isRoundExpired ? (
        <div className="space-y-3">
          <div className="bg-destructive/10 border border-destructive/30 rounded p-3">
            <p className="text-sm text-destructive">Round has expired. Start a new round to continue playing.</p>
          </div>
          <Button
            onClick={handleStartNewRound}
            disabled={isLoading}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            size="lg"
          >
            {isLoading ? "Starting Round..." : "Start New Round"}
          </Button>
        </div>
      ) : !isStakingAvailable ? (
        <div className="space-y-3">
          <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
            <p className="text-sm text-orange-400">Staking is temporarily unavailable.<br />You must wait up to 3 minutes before staking is available again for the next round.</p>
          </div>
          <Button disabled className="w-full" size="lg">
            Staking Unavailable
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* <div className="flex items-center gap-2">
            <input
              type="text"
              value={stakeInput}
              onChange={(e) => {
                const v = e.target.value
                setStakeInput(v)
                const parsed = parseEther(v)
                setIsAmountValid(parsed !== null && parsed >= MINIMUM_STAKE)
              }}
              className="input input-bordered w-full"
              aria-label="Stake amount in STT"
            />
            <div className="text-xs text-muted-foreground">STT</div>
          </div>
          {!isAmountValid && (
            <div className="text-xs text-destructive">Amount must be a valid number and at least {formatEther(MINIMUM_STAKE)} STT</div>
          )} */}
          <Button
            onClick={handleStake}
            disabled={isLoading || isConfirming || !isConnected || !isAmountValid}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            size="lg"
          >
            {!isConnected
              ? "Connect Wallet to Stake"
              : isLoading
                ? "Processing..."
                : isConfirming
                  ? "Confirming Transaction..."
                  : `Stake ${formatHbar(minimumStake)} STT`}
          </Button>
        </div>
      )}

      {localError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded p-3">
          <p className="text-sm text-destructive">{localError}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-accent/10 border border-accent/30 rounded p-3">
          <p className="text-sm text-accent">{successMessage}</p>
        </div>
      )}

      {/* Info section */}
      <div className="pt-4 border-t border-border space-y-2">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Each stake extends the deadline by 5 minutes</p>
          <p>• Last staker wins 70% of the prize pool</p>
          <p>• Random participants win 20%</p>
        </div>
      </div>
    </div>
  )
}
