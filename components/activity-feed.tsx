"use client"

import { useActivityFeed } from "@/hooks/use-activity-feed"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, RefreshCw } from "lucide-react"
import { useCallback } from "react"

export function ActivityFeed() {
  const { events, isLoading, error, refresh } = useActivityFeed()

  const handleRefresh = useCallback(async () => {
    await refresh()
  }, [refresh])

  const getEventIcon = (eventName: string) => {
    switch (eventName) {
      case "RoundEnded":
        return "🏆"
      case "RoundStarted":
        return "▶️"
      case "StakeReceived":
        return "💰"
      case "StakeWithdrawn":
        return "↩️"
      case "RewardClaimed":
        return "🎁"
      case "RewardsDistributed":
        return "💸"
      default:
        return "📢"
    }
  }

  const getEventColor = (eventName: string) => {
    switch (eventName) {
      case "RoundEnded":
        return "border-yellow-500/30 bg-yellow-500/5"
      case "RoundStarted":
        return "border-blue-500/30 bg-blue-500/5"
      case "StakeReceived":
        return "border-green-500/30 bg-green-500/5"
      case "StakeWithdrawn":
        return "border-orange-500/30 bg-orange-500/5"
      case "RewardClaimed":
        return "border-purple-500/30 bg-purple-500/5"
      case "RewardsDistributed":
        return "border-pink-500/30 bg-pink-500/5"
      default:
        return "border-slate-500/30 bg-slate-500/5"
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Live Activity
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total Events: {events.length}</span>
          {error && <span className="text-red-500">Error: {error}</span>}
        </div>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="mx-auto h-12 w-12 opacity-50 mb-3" />
            <p className="text-lg font-medium">No activity yet</p>
            <p className="text-sm">Contract events will appear here in real-time</p>
          </div>
        ) : (
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-2">
              {events.map((event, idx) => (
                <div
                  key={`${event.id}-${idx}`}
                  className={`p-3 rounded-lg border flex items-start gap-3 ${getEventColor(
                    event.eventName
                  )}`}
                >
                  <div className="text-xl mt-0.5">{getEventIcon(event.eventName)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {event.eventName}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Block {event.blockNumber}
                      </span>
                    </div>
                    <p className="text-sm font-medium break-word">{event.displayText}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {event.transactionHash.slice(0, 10)}...{event.transactionHash.slice(-8)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}




