"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useContractWrite } from "@/hooks/use-contract-write"

interface AdminPanelProps {
  onStakeAmountUpdate?: () => void;
}

export function AdminPanel({ onStakeAmountUpdate }: AdminPanelProps) {
  const { executeStartNewRound, executeEmergencyWithdraw, executeUpdateStakeAmount, executeUpdateBufferSettings, executeUpdateStakingWaitPeriod, isLoading, error, hash, isConnected } = useContractWrite()
  const [stakeAmount, setStakeAmount] = useState<string>("")
  const [stakeBuffer, setStakeBuffer] = useState(0)
  const [bufferDelay, setBufferDelay] = useState(0)
  const [stakingWaitPeriod, setStakingWaitPeriod] = useState<string>("")
  const [inputError, setInputError] = useState<string | null>(null)

  // Comment out the entire panel for production
  // return null

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4 mt-8">
      <h3 className="text-lg font-semibold">Admin Controls (Owner Only)</h3>
      <div className="space-y-2">
        <Button onClick={executeStartNewRound} disabled={isLoading || !isConnected} className="w-full">
          Start New Round
        </Button>
        <Button onClick={executeEmergencyWithdraw} disabled={isLoading || !isConnected} className="w-full">
          Emergency Withdraw
        </Button>
      </div>
      <div className="space-y-2">
        <div>
          <label className="block text-sm">Stake Amount</label>
          <input
            type="number"
            step="0.000000000000000001"
            min="0"
            placeholder="e.g. 0.01 (STT)"
            value={stakeAmount}
            onChange={e => {
              const val = e.target.value;
              // allow up to 18 decimal places for STT
              if (!/^\d*(\.\d{0,18})?$/.test(val)) {
                setInputError("Stake amount must be a non-negative number with up to 18 decimals.");
              } else {
                setInputError(null);
              }
              setStakeAmount(val);
            }}
            className="input input-bordered w-full "
          />
          <Button
            onClick={async () => {
              // Validate numeric format
              if (!/^[0-9]+(\.[0-9]+)?$/.test(stakeAmount)) {
                setInputError("Stake amount must be a non-negative number.");
                return;
              }

              // Convert STT (18 decimals) to its smallest unit (wei-like) using BigInt math
              const [whole, fraction = ""] = stakeAmount.split(".");
              const wholeBig = BigInt(whole || "0");
              // Defensive: ensure fraction contains only digits and pad/truncate to 18 digits
              const fracDigits = fraction.replace(/\D/g, "");
              const fracPadded = (fracDigits + "0".repeat(18)).slice(0, 18);
              const TEN_POW_18 = BigInt("1000000000000000000");
              const tinybars = wholeBig * TEN_POW_18 + BigInt(fracPadded);
              setInputError(null);
              const result = await executeUpdateStakeAmount(tinybars);
              if (onStakeAmountUpdate && result) {
                onStakeAmountUpdate();
              }
            }}
            disabled={isLoading || !isConnected}
            className="w-full mt-2"
          >
            Update Stake Amount
          </Button>
        </div>
        <div>
          <label className="block text-sm">Stake Buffer</label>
          <input
            type="number"
            step="1"
            min="0"
            value={stakeBuffer}
            onChange={e => {
              const val = e.target.value;
              if (!/^\d+$/.test(val)) {
                setInputError("Stake buffer must be a non-negative integer.");
                // keep previous value until valid input is provided
              } else {
                setInputError(null);
                setStakeBuffer(Number(val));
              }
            }}
            className="input input-bordered w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">Units: seconds</p>
          <label className="block text-sm mt-1">Buffer Delay</label>
          <input
            type="number"
            step="1"
            min="0"
            value={bufferDelay}
            onChange={e => {
              const val = e.target.value;
              if (!/^\d+$/.test(val)) {
                setInputError("Buffer delay must be a non-negative integer.");
                // keep previous value until valid input is provided
              } else {
                setInputError(null);
                setBufferDelay(Number(val));
              }
            }}
            className="input input-bordered w-full"
          />
          <Button
            onClick={() => {
              if (!Number.isInteger(stakeBuffer) || stakeBuffer < 0 || !Number.isInteger(bufferDelay) || bufferDelay < 0) {
                setInputError("Stake buffer and buffer delay must be non-negative integers.");
                return;
              }
              setInputError(null);
              executeUpdateBufferSettings(stakeBuffer, bufferDelay);
            }}
            disabled={isLoading || !isConnected}
            className="w-full mt-2"
          >
            Update Buffer Settings
          </Button>
        </div>
        <div>
          <label className="block text-sm">Staking Wait Period</label>
          <input
            type="number"
            step="1"
            min="0"
            placeholder="e.g. 10 (minutes)"
            value={stakingWaitPeriod}
            onChange={e => {
              const val = e.target.value;
              if (!/^\d+$/.test(val)) {
                setInputError("Staking wait period must be a non-negative integer (minutes).");
              } else {
                setInputError(null);
              }
              setStakingWaitPeriod(val);
            }}
            className="input input-bordered w-full"
          />
          <Button
            onClick={() => {
              const num = Number(stakingWaitPeriod);
              if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
                setInputError("Staking wait period must be a non-negative integer (minutes).");
                return;
              }
              // Convert minutes to seconds for contract (use BigInt math)
              const seconds = BigInt(num) * BigInt(60);
              setInputError(null);
              executeUpdateStakingWaitPeriod(seconds);
            }}
            disabled={isLoading || !isConnected}
            className="w-full mt-2"
          >
            Update Staking Wait Period
          </Button>
        </div>
      </div>
  {(inputError || error) && <div className="text-destructive mt-2">{inputError || error}</div>}
  {hash && (
    <div className="text-accent mt-2">
      <a href={`https://explorer.somnia.network/tx/${hash}`} target="_blank" rel="noreferrer noopener">
        Tx: {hash.slice(0, 10)}...
      </a>
    </div>
  )}
    </div>
  )
}

// To hide admin panel in production, uncomment below:
// export function AdminPanel() { return null }
