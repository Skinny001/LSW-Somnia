"use client"

import { useEffect, useState } from 'react'
import { initializeSomniaSDK} from '@/lib/somnia-streams'
import { getCurrentRoundInfo, fetchLatestRoundEvent } from '@/lib/contract-service'
import { SchemaEncoder } from '@somnia-chain/streams'

export interface RoundHistory {
  roundId: string
  winner: string
  totalAmount: string
  timestamp: number
}

export function useSmartRoundHistory() {
  const [rounds, setRounds] = useState<RoundHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const loadRounds = async () => {
      try {
        setIsLoading(true)
        const sdk = await initializeSomniaSDK()
        if (!sdk) throw new Error('SDK failed to initialize')

        const publisherAddress = process.env.NEXT_PUBLIC_LSW_PUBLISHER_ADDRESS || 
          '0x311350f1c7ba0f1749572cc8a948dd7f9af1f42a'
        const schemaId = process.env.NEXT_PUBLIC_LSW_STREAMS_SCHEMA_ID

        if (!schemaId) throw new Error('Schema ID not configured')

        // Fetch rounds from Streams using literal schema string to bypass private schema lookup
        const ROUND_ENDED_SCHEMA = 'uint256 roundId, address winner, uint256 totalAmount, uint256 timestamp'
        const schemaEncoder = new SchemaEncoder(ROUND_ENDED_SCHEMA)

        let streamsData: any[] = []
        try {
          const rawData = await sdk.streams.getAllPublisherDataForSchema(
            schemaId as any,
            publisherAddress as `0x${string}`
          )

          if (Array.isArray(rawData)) {
            // Decode hex data using SchemaEncoder
            const decoded: any[] = []
            for (const item of rawData) {
              try {
                if (typeof item === 'string') {
                  // Raw hex data - decode it
                  const decodedItem = schemaEncoder.decodeData(item as `0x${string}`)
                  decoded.push(decodedItem)
                } else if (Array.isArray(item)) {
                  // Already decoded
                  decoded.push(item)
                }
              } catch (e) {
                // Skip unparseable items
              }
            }
            streamsData = decoded
          }  

          console.log("Fetched recent rounds from Streams:", streamsData)
        } catch (err) {
          console.warn('Failed to fetch with literal schema, trying with schema ID:', err)
          try {
            const total = await sdk.streams.totalPublisherDataForSchema(
              schemaId as `0x${string}`,
              publisherAddress as `0x${string}`
            )
            if (total && typeof total === 'bigint' && total > BigInt(0)) {
              const start = total > BigInt(50) ? total - BigInt(50) : BigInt(0)
              const rawData = await sdk.streams.getBetweenRange(
                schemaId as `0x${string}`,
                publisherAddress as `0x${string}`,
                start,
                total
              )
              if (Array.isArray(rawData)) {
                streamsData = rawData
              }
            }
          } catch (err2) {
            console.warn('Both Streams fetch methods failed:', err2)
            streamsData = []
          }
        }

        // Parse Streams data (may be empty if schema is private)
        const parsedRounds = streamsData.length > 0 ? parseStreamsData(streamsData) : []
        if (parsedRounds.length > 0) {
          setRounds(parsedRounds)
        }

        // Get current contract round
        const roundInfo = await getCurrentRoundInfo()
        const currentRoundId = Number(roundInfo.roundId)
        const latestStreamRoundId = parsedRounds.length > 0 ? Number(parsedRounds[0].roundId) : 0

        // If out of sync, push latest event to Streams
        // Current round is still running, so history is always -1. Sync if stream is behind.
        if (currentRoundId > latestStreamRoundId + 1) {
          setIsSyncing(true)
          
          // Fetch all rounds from Logs API and push those missing from Streams
          const apiUrl = `https://somnia.w3us.site/api/v2/addresses/${process.env.NEXT_PUBLIC_LSW_CONTRACT_ADDRESS}/logs`
          try {
            const response = await fetch(apiUrl)
            const data = await response.json()
            const allLogs = data.items || []
            
            const roundsToSync: RoundHistory[] = []
            const syncedRoundIds = new Set(parsedRounds.map(r => Number(r.roundId)))
            
            for (const log of allLogs) {
              const methodCall = log.decoded?.method_call
              if (methodCall?.includes('RoundEnded')) {
                const params = log.decoded?.parameters || []
                const roundIdParam = params.find((p: any) => p.name === 'roundId')
                const winnerParam = params.find((p: any) => p.name === 'winner')
                const totalAmountParam = params.find((p: any) => p.name === 'totalAmount')
                
                if (roundIdParam?.value && winnerParam?.value && totalAmountParam?.value) {
                  const roundId = Number(roundIdParam.value)
                  
                  // Only push if not already in Streams
                  if (!syncedRoundIds.has(roundId)) {
                    roundsToSync.push({
                      roundId: roundId.toString(),
                      winner: winnerParam.value,
                      totalAmount: totalAmountParam.value,
                      timestamp: Math.floor(Date.now() / 1000)
                    })
                    syncedRoundIds.add(roundId)
                  }
                }
              }
            }
            
            // Push all missing rounds to Streams via API
            for (const round of roundsToSync) {
              try {
                const response = await fetch('/api/publish-round', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    roundId: round.roundId,
                    winner: round.winner,
                    totalAmount: round.totalAmount
                  })
                })
                
                if (!response.ok) {
                  const error = await response.json()
                }
              } catch (err) {
                // Continue even if push fails - data is in local state
              }
            }
            
            // Update UI with all synced rounds
            if (roundsToSync.length > 0) {
              setRounds(prev => [...roundsToSync, ...prev].sort((a, b) => Number(b.roundId) - Number(a.roundId)))
            }
          } catch (err) {
            console.error('Failed to sync rounds:', err)
          }
          
          setIsSyncing(false)
        }

        setError(null)
      } catch (err) {
        console.error('❌ Error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    loadRounds()
  }, [])

  return {
    rounds,
    isLoading: isLoading || isSyncing,
    error,
    isSyncing,
    triggerSync: () => {},
    syncState: { currentContractRoundId: '', latestStreamRoundId: '', isSynced: true, missingRounds: [] }
  }
}

function parseStreamsData(data: any[]): RoundHistory[] {
  if (!Array.isArray(data) || data.length === 0) return []

  const seen = new Set<string>()

  return data
    .map((item: any) => {
      try {
        // Handle decoded SchemaDecodedItem arrays from SchemaEncoder
        if (Array.isArray(item)) {
          const roundIdItem = item.find((i: any) => i.name === 'roundId')
          const winnerItem = item.find((i: any) => i.name === 'winner')
          const totalAmountItem = item.find((i: any) => i.name === 'totalAmount')
          const timestampItem = item.find((i: any) => i.name === 'timestamp')

          if (roundIdItem && winnerItem && totalAmountItem && timestampItem) {
            // Extract actual value from nested structure
            const getRoundValue = (val: any) => val && typeof val === 'object' && 'value' in val ? val.value : val
            
            const roundId = getRoundValue(roundIdItem.value).toString()
            
            // Skip duplicates
            if (seen.has(roundId)) {
              return null
            }
            seen.add(roundId)
            
            return {
              roundId,
              winner: getRoundValue(winnerItem.value).toString(),
              totalAmount: getRoundValue(totalAmountItem.value).toString(),
              timestamp: Number(getRoundValue(timestampItem.value))
            }
          }
        }
        return null
      } catch {
        return null
      }
    })
    .filter((item): item is RoundHistory => item !== null)
    .sort((a, b) => Number(b.roundId) - Number(a.roundId))
}
