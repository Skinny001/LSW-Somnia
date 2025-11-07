"use client"

import { useEffect, useState } from "react"

interface TimerDisplayProps {
  timeRemaining: bigint
  timeUntilStaking: bigint
  isStakingAvailable: boolean
  isActive: boolean
}

export function TimerDisplay({ timeRemaining, timeUntilStaking, isStakingAvailable, isActive }: TimerDisplayProps) {
  const [displayTime, setDisplayTime] = useState("00:00")
  const [status, setStatus] = useState<"waiting" | "active" | "buffer" | "expired">("waiting")
  const [displayLabel, setDisplayLabel] = useState("")
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [initialTimeRemaining, setInitialTimeRemaining] = useState<number>(0)

  useEffect(() => {
    setStartTime(Date.now())
    setInitialTimeRemaining(Number(timeRemaining))
  }, [timeRemaining])

  useEffect(() => {
    const updateDisplay = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
      let seconds: number
      let newStatus: "waiting" | "active" | "buffer" | "expired" = "waiting"
      let label = ""

      if (!isActive) {
        seconds = Math.max(0, Number(timeUntilStaking) - elapsedSeconds)
        newStatus = "waiting"
        label = "Staking Opens In"
      } else if (initialTimeRemaining > 0) {
        seconds = Math.max(0, initialTimeRemaining - elapsedSeconds)
        if (seconds <= 600) {
          newStatus = "buffer"
          label = "Buffer Period - Staking Extends Deadline"
        } else {
          newStatus = "active"
          label = "Time Remaining"
        }
      } else {
        seconds = 0
        newStatus = "expired"
        label = "Round Expired"
      }

      const minutes = Math.floor(seconds / 60)
      const secs = seconds % 60
      setDisplayTime(`${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`)
      setStatus(newStatus)
      setDisplayLabel(label)
    }

    updateDisplay()
    const interval = setInterval(updateDisplay, 1000)
    return () => clearInterval(interval)
  }, [timeRemaining, timeUntilStaking, isActive, startTime, initialTimeRemaining])

  const statusConfig = {
    waiting: {
      bgClass: "bg-muted/20",
      textClass: "text-muted-foreground",
      pulseClass: "",
    },
    active: {
      bgClass: "bg-accent/10",
      textClass: "text-accent",
      pulseClass: "pulse-glow",
    },
    buffer: {
      bgClass: "bg-orange-500/10",
      textClass: "text-orange-400",
      pulseClass: "countdown-pulse",
    },
    expired: {
      bgClass: "bg-destructive/10",
      textClass: "text-destructive",
      pulseClass: "",
    },
  }

  const config = statusConfig[status]

  return (
    <div className={`flex flex-col items-center gap-4 p-8 rounded-lg border border-border ${config.bgClass}`}>
      <div className={`text-6xl font-bold font-mono ${config.textClass} ${config.pulseClass}`}>{displayTime}</div>
      <div className="space-y-1 text-center">
        <div className={`text-sm font-semibold uppercase tracking-wider ${config.textClass}`}>{displayLabel}</div>
        {status === "buffer" && (
          <div className="text-xs text-muted-foreground">Each stake adds 5 minutes to the deadline</div>
        )}
      </div>
    </div>
  )
}
