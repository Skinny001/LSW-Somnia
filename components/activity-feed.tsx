"use client"
import { formatEther, formatHbar} from "@/lib/format-utils"
import { subscribeToNetworkEvents, type NetworkActivity } from "@/lib/somnia-sdk"
import React, { useEffect, useState } from "react"
import { form } from "viem/chains"

interface Activity {
  id: string
  type: "stake" | "round_start" | "round_end"
  data: any
  timestamp: number
  source?: "local" | "network" // Track source of activity
}

interface ActivityFeedProps {
  currentRoundId?: bigint // For round-specific filtering
  onStakeActivity?: (activity: Activity) => void // Callback for immediate stake display
}

export function ActivityFeed({ currentRoundId, onStakeActivity }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])

  // Key for localStorage for all rounds
  const STORAGE_KEY = 'lsw-activity-all-rounds';

  // Load activities for all rounds from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let loaded: Activity[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          loaded = parsed;
        }
      }
      // Merge SDK events (if any) with loaded activities, deduplicate by id
      setActivities(prev => {
        if (prev.length === 0) return loaded;
        const merged = [...loaded, ...prev].reduce<Activity[]>((acc, act) => {
          if (!acc.find(a => a.id === act.id)) acc.push(act);
          return acc;
        }, []);
        return merged;
      });
    } catch (err) {
      console.warn('Failed to load activities from localStorage:', err);
      setActivities([]);
    }
  }, []);

  // Save activities to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    } catch (err) {
      console.warn('Failed to save activities to localStorage:', err);
    }
  }, [activities]);

  // Function to add immediate stake activity (called directly from staking)
  const addImmediateActivity = (staker: string, amount: bigint, roundId: bigint) => {
    // Add activity for the round after transaction confirmation
    const activity: Activity = {
      id: `immediate-stake-${Date.now()}-${Math.random()}`,
      type: "stake",
      data: {
        roundId: roundId,
        staker: staker,
        amount: amount.toString(),
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      source: "local"
    };
    setActivities(prev => {
      // Add to all activities, keep max 100
      const updated = [activity, ...prev].slice(0, 100);
      // Save to localStorage immediately
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (onStakeActivity) {
      onStakeActivity(activity);
    }
  }

  // Expose the function globally so StakingInterface can call it
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).addStakeActivity = addImmediateActivity
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).addStakeActivity
      }
    }
  }, [currentRoundId])

  // Clear activities when round changes
  // Removed unnecessary useEffect for clearing activities on round change

  // Memoize filteredActivities to prevent infinite update loop
  const filteredActivities: Activity[] = React.useMemo(() => {
    // Show all activities for the current round
    return Array.isArray(activities)
      ? activities.filter((activity: Activity) => {
          if (activity.type === "round_end") {
            const winner = activity.data?.winner;
            if (!winner || winner === "0x0000000000000000000000000000000000000000" || winner === "0x0") {
              return false;
            }
          }
          // Only show activities for current round
          if (currentRoundId && activity.data?.roundId && BigInt(activity.data.roundId) !== currentRoundId) {
            return false;
          }
          return true;
        })
      : [];
  }, [activities, currentRoundId]);


  // Set up SDK event subscriptions for activities
  useEffect(() => {
    let mounted = true;
    let stakeUnsubscribe: (() => void) | null = null;
    let roundUnsubscribe: (() => void) | null = null;

    const saveActivities = (activities: Activity[]) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
      } catch {}
    };

    const setupSDKSubscriptions = async () => {
      try {
        console.log('🚀 Setting up SDK subscriptions for round:', currentRoundId);

        // Subscribe to stake events
        stakeUnsubscribe = await subscribeToNetworkEvents('PlayerStaked', (event: any) => {
          console.log('🔥🔥🔥 RAW STAKE SDK EVENT RECEIVED:', JSON.stringify(event, null, 2));
          if (mounted && currentRoundId) {
            console.log('📡 Processing SDK Stake event for round:', currentRoundId, event);

            const activity: Activity = {
              id: `sdk-stake-${event.timestamp || Date.now()}-${Math.random()}`,
              type: "stake",
              data: {
                roundId: currentRoundId,
                staker: event.address || event.player || event.data?.address,
                amount: event.amount || event.data?.amount,
                timestamp: event.timestamp || Date.now()
              },
              timestamp: event.timestamp || Date.now(),
              source: "network"
            };

            setActivities(prev => {
              const newActivities = [activity, ...prev.slice(0, 99)];
              saveActivities(newActivities);
              return newActivities;
            });
          } else {
            console.log('⚠️ SDK event ignored - mounted:', mounted, 'currentRoundId:', currentRoundId);
          }
        });

        // Subscribe to round events
        roundUnsubscribe = await subscribeToNetworkEvents('RoundWon', (event: any) => {
          if (mounted && currentRoundId) {
            console.log('📡 SDK Round event received:', event);

            const activity: Activity = {
              id: `sdk-round-${event.timestamp || Date.now()}-${Math.random()}`,
              type: "round_end",
              data: {
                roundId: currentRoundId,
                winner: event.winner,
                totalAmount: event.totalAmount,
                timestamp: event.timestamp || Date.now()
              },
              timestamp: event.timestamp || Date.now(),
              source: "network"
            };

            setActivities(prev => {
              const newActivities = [activity, ...prev.slice(0, 99)];
              saveActivities(newActivities);
              return newActivities;
            });
          }
        });

        console.log('✅ SDK activity subscriptions set up for round:', currentRoundId);
        // Debug: Log subscription status
        console.log('🔍 Subscription status:', {
          stakeUnsubscribe: !!stakeUnsubscribe,
          roundUnsubscribe: !!roundUnsubscribe,
          mounted,
          currentRoundId
        });
      } catch (error) {
        console.error('❌ Failed to set up SDK activity subscriptions:', error);
      }
    };

    setupSDKSubscriptions();

    return () => {
      mounted = false;
      if (stakeUnsubscribe) stakeUnsubscribe();
      if (roundUnsubscribe) roundUnsubscribe();
    };
  }, [currentRoundId]);

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

  const getActivityIcon = (type: string, source?: string) => {
    const baseIcon = (() => {
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
    })()
    
    // Add network indicator for network activities
    return source === 'network' ? `🌐 ${baseIcon}` : baseIcon
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Live Activity</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>📡 Somnia SDK</span>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Waiting for activity...</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-background rounded border border-border/50 hover:border-border transition-colors"
            >
              <div className="text-lg mt-0.5">{getActivityIcon(activity.type, activity.source)}</div>
              <div className="flex-1 min-w-0">
                {activity.type === "stake" && (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      <span 
                        className="text-accent font-mono text-xs cursor-pointer hover:text-accent/80" 
                        title={activity.data?.staker || "No address available"}
                      >
                        {formatAddress(activity.data?.staker || activity.data?.user || activity.data?.address)}
                      </span> staked
                      {activity.source === 'network' && (
                        <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          🌐 Network
                        </span>
                      )}
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
                        className="text-green-600 font-mono font-bold text-xs cursor-pointer hover:text-green-500" 
                        title={activity.data.winner}
                      >
                        {formatAddress(activity.data.winner)}
                      </span> won the round!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Prize: <span className="font-semibold text-yellow-600">
                        {formatEther(activity.data.totalAmount)} STT
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
                              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
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
                              className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono font-semibold border border-blue-300"
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
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatTime(activity.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}




