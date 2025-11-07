"use client"
import { formatEther, formatHbar} from "@/lib/format-utils"

// ...existing code...
//         ) : (
//           liveActivities.map((activity) => (
//             <div
//               key={activity.id}
//               className="flex items-start gap-3 p-3 bg-background rounded border border-border/50 hover:border-border transition-colors"
//             >
//               <div className="text-lg mt-0.5">{getActivityIcon(activity.type)}</div>
//               <div className="flex-1 min-w-0">
//                 {activity.type === "stake" && (
//                   <div>
//                     <p className="text-sm font-medium text-foreground">
//                       <span className="text-accent">{formatAddress(activity.data.staker)}</span> staked
//                     </p>
//                     <p className="text-xs text-muted-foreground">
//                       {activity.data.amount ? formatEther(activity.data.amount) : "0"} HBAR
//                     </p>
//                   </div>
//                 )}
//                 {activity.type === "round_end" && (
//                   <div>
//                     <p className="text-sm font-medium text-foreground">
//                       <span className="text-accent">{formatAddress(activity.data.winner)}</span> won the round
//                     </p>
//                     <p className="text-xs text-muted-foreground">
//                       Prize: {formatEther(activity.data.totalAmount)} HBAR
//                     </p>
//                   </div>
//                 )}
//                 {activity.type === "round_start" && (
//                   <div>
//                     <p className="text-sm font-medium text-foreground">Round started</p>
//                     <p className="text-xs text-muted-foreground">Round #{activity.data.roundId?.toString()}</p>
//                   </div>
//                 )}
//               </div>
//               <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(activity.timestamp)}</span>
//             </div>
//           ))
//         )}
//       </div>
//     </div>
//   )
// }





import React, { useEffect, useState } from "react"
import { form } from "viem/chains"

interface Activity {
  id: string
  type: "stake" | "round_start" | "round_end"
  data: any
  timestamp: number
}

interface ActivityFeedProps {
  activities: Activity[]
}

export function ActivityFeed({ activities }: ActivityFeedProps) {

  // Memoize filteredActivities to prevent infinite update loop
  const filteredActivities = React.useMemo(() => {
    return activities.filter((activity) => {
      if (activity.type === "round_end") {
        const winner = activity.data?.winner
        if (!winner || winner === "0x0000000000000000000000000000000000000000" || winner === "0x0") {
          return false
        }
      }
      return true
    })
  }, [activities])

  const [liveActivities, setLiveActivities] = useState<Activity[]>(filteredActivities)

  useEffect(() => {
    setLiveActivities(filteredActivities)
    const interval = setInterval(() => {
      setLiveActivities([...filteredActivities])
    }, 10000)
    return () => clearInterval(interval)
  }, [activities, filteredActivities])

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  const formatAddress = (addr: string | undefined) => {
    
    if (!addr) {
      console.warn("Address is undefined or null")
      return "Unknown"
    }
    
    // Convert to string if it's not already
    const addressStr = String(addr)
    
    // Check if it's a zero address
    if (addressStr === "0x0000000000000000000000000000000000000000" || addressStr === "0x0") {
      return "Zero Address"
    }
    
    // Make sure address is long enough to format
    if (addressStr.length < 10) {
      console.warn("Address too short:", addressStr)
      return addressStr
    }
    
    return `${addressStr.slice(0, 6)}...${addressStr.slice(-4)}`
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "stake":
        return "📍"
      case "round_end":
        return "🏆"
      case "round_start":
        return "🎮"
      default:
        return "•"
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold">Live Activity</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {liveActivities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Waiting for activity...</p>
          </div>
        ) : (
          liveActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-background rounded border border-border/50 hover:border-border transition-colors"
            >
              <div className="text-lg mt-0.5">{getActivityIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                {activity.type === "stake" && (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      <span 
                        className="text-accent font-mono cursor-pointer hover:text-accent/80" 
                        title={activity.data?.staker || "No address available"}
                      >
                        {formatAddress(activity.data?.staker || activity.data?.user || activity.data?.address)}
                      </span> staked
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Amount: <span className="font-semibold text-green-600">
                        {activity.data?.amount ? formatHbar(activity.data.amount) : "0"} STT
                      </span>
                    </p>
                    {/* Debug info - remove this after fixing */}
                    {(!activity.data?.staker && !activity.data?.user && !activity.data?.address) && (
                      <p className="text-xs text-red-500 mt-1">
                        Debug: No staker address found. Available keys: {Object.keys(activity.data || {}).join(", ")}
                      </p>
                    )}
                  </div>
                )}
                {activity.type === "round_end" && (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      🎉 <span 
                        className="text-green-600 font-mono font-bold cursor-pointer hover:text-green-500" 
                        title={activity.data.winner}
                      >
                        {formatAddress(activity.data.winner)}
                      </span> won the round!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Prize: <span className="font-semibold text-yellow-600">
                        {formatEther(activity.data.totalAmount)} HBAR
                      </span>
                    </p>
                    {activity.data.stakers && activity.data.stakers.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-foreground mb-1">
                          Participants ({activity.data.stakers.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {activity.data.stakers.slice(0, 10).map((staker: string, index: number) => (
                            <span
                              key={index}
                              className={`text-xs px-2 py-0.5 rounded font-mono ${
                                staker.toLowerCase() === activity.data.winner.toLowerCase()
                                  ? 'bg-green-100 text-green-700 font-bold border border-green-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                              title={staker}
                            >
                              {formatAddress(staker)}
                            </span>
                          ))}
                          {activity.data.stakers.length > 10 && (
                            <span className="text-xs text-muted-foreground px-2 py-0.5">
                              +{activity.data.stakers.length - 10} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {activity.data.randomWinners && activity.data.randomWinners.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-foreground mb-1">
                          🎲 Random Winners:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {activity.data.randomWinners.map((winner: string, index: number) => (
                            <span
                              key={index}
                              className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono font-semibold border border-blue-300"
                              title={winner}
                            >
                              {formatAddress(winner)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activity.type === "round_start" && (
                  <div>
                    <p className="text-sm font-medium text-foreground">Round started</p>
                    <p className="text-xs text-muted-foreground">
                      Round #{activity.data.roundId?.toString()}
                    </p>
                    {activity.data.duration && (
                      <p className="text-xs text-muted-foreground">
                        Duration: {activity.data.duration}s
                      </p>
                    )}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatTime(activity.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}