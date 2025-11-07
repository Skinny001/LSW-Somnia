"use client"

interface GameStatusProps {
  isActive: boolean
  isStakingAvailable: boolean
  timeRemaining: bigint
  timeUntilStaking: bigint
}

export function GameStatus({ isActive, isStakingAvailable, timeRemaining, timeUntilStaking }: GameStatusProps) {
  const getStatusMessage = () => {
    if (!isActive) {
      const minutesUntilStart = Math.floor(Number(timeUntilStaking) / 60)
      return {
        title: "Waiting to Start",
        description: `Staking opens in ${minutesUntilStart} minute${minutesUntilStart !== 1 ? "s" : ""}`,
        color: "text-muted-foreground",
        bgColor: "from-muted/20 to-muted/10",
        borderColor: "border-muted/30",
      }
    }

    if (Number(timeRemaining) <= 600) {
      return {
        title: "Buffer Period Active",
        description: "Staking extends the deadline by 5 minutes each time",
        color: "text-orange-400",
        bgColor: "from-orange-500/20 to-orange-500/10",
        borderColor: "border-orange-500/30",
      }
    }

    if (Number(timeRemaining) <= 1800) {
      return {
        title: "Final 30 Minutes",
        description: "The round is heating up - place your stake now",
        color: "text-accent",
        bgColor: "from-accent/20 to-accent/10",
        borderColor: "border-accent/30",
      }
    }

    return {
      title: "Round Active",
      description: "Place your stake to compete for the prize pool",
      color: "text-accent",
      bgColor: "from-accent/20 to-accent/10",
      borderColor: "border-accent/30",
    }
  }

  const status = getStatusMessage()

  return (
    <div className={`bg-linear-to-r ${status.bgColor} border ${status.borderColor} rounded-lg p-6`}>
      <h2 className={`text-2xl font-bold ${status.color} mb-2`}>{status.title}</h2>
      <p className="text-muted-foreground">{status.description}</p>
    </div>
  )
}
