"use client"

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Trophy, Users, DollarSign, RefreshCcw, ChevronDown, AlertCircle } from 'lucide-react'
import { useSmartRoundHistory } from '@/hooks/use-smart-round-history'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function RoundHistory() {
  const { rounds, isLoading, error, isSyncing, triggerSync, syncState } = useSmartRoundHistory()
  const [showMore, setShowMore] = useState(false)

  // Format wallet address for display
  const formatWalletAddress = useCallback((address: string) => {
    if (!address || address === "0x0000000000000000000000000000000000000000") return "No Winner"
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [])

  const handleRefresh = useCallback(async () => {
    await triggerSync()
  }, [triggerSync])

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Round History
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total Rounds: {rounds.length}</span>
          {error && (
            <span className="text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Error: {error}
            </span>
          )}
          {isSyncing && (
            <span className="text-blue-500 flex items-center gap-1">
              <RefreshCcw className="h-3 w-3 animate-spin" />
              Syncing...
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {rounds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="mx-auto h-12 w-12 opacity-50 mb-3" />
            <p className="text-lg font-medium">No completed rounds yet</p>
            <p className="text-sm">Round history will appear here when rounds are completed</p>
            <p className="text-xs mt-4 text-muted-foreground/70">Using Somnia Data Streams for real-time updates</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Featured - Last 2 Rounds */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Latest Winners
              </h3>
              <div className="space-y-3">
                {rounds.slice(0, 2).map((round, idx) => (
                  <div
                    key={`featured-${idx}`}
                    className="p-4 rounded-lg border-2 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="default" className="font-mono bg-yellow-600 hover:bg-yellow-700">
                          #{round.roundId}
                        </Badge>
                        <div className="flex items-center gap-1 text-yellow-600">
                          <Trophy className="h-4 w-4" />
                          <span className="font-semibold">Winner</span>
                        </div>
                      </div>
                      {idx === 0 && <Badge variant="secondary" className="text-xs">Most Recent</Badge>}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Winner:</span>
                          <span className="font-mono text-sm font-semibold">
                            {formatWalletAddress(round.winner)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Prize Pool:</span>
                          <span className="font-bold text-green-600">
                            {(Number(round.totalAmount) / 1e18).toFixed(4)} STT
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scrollable history of all rounds */}
            {rounds.length > 2 && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMore(!showMore)}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                  {showMore ? 'Hide' : 'Show'} Previous Rounds ({rounds.length - 2} more)
                </Button>

                {showMore && (
                  <ScrollArea className="h-80 mt-4 border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                    <div className="space-y-3 pr-4">
                      {rounds.slice(2).map((round, idx) => (
                        <div
                          key={`history-${idx}`}
                          className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono text-xs">
                                #{round.roundId}
                              </Badge>
                              <span className="text-sm font-medium text-muted-foreground">
                                {formatWalletAddress(round.winner)}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-green-600">
                              {(Number(round.totalAmount) / 1e18).toFixed(4)} STT
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        )}
        
        <Separator className="my-4" />
        
        <div className="text-xs text-muted-foreground text-center">
          Powered by Somnia Data Streams • Real-time on-chain data
        </div>
      </CardContent>
    </Card>
  )
}
