/**
 * Hook to initialize Somnia Streams on app load
 * Fetches and caches schema ID on first page load
 */

import { useEffect, useRef } from 'react'
import { initializeSomniaSDK, computeRoundEndedSchemaId } from '@/lib/somnia-streams'
import { setCachedSchemaId, isSchemaIdCached } from '@/lib/streams-cache'

export function useInitializeStreams() {
  const initializationRef = useRef(false)

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initializationRef.current) return
    initializationRef.current = true

    const initializeStreams = async () => {
      try {
        // Skip if already cached
        if (isSchemaIdCached()) {

          return
        }



        // Initialize SDK
        const sdk = await initializeSomniaSDK()
        if (!sdk) {
          console.warn('⚠️ SDK initialization failed')
          return
        }

        // Compute and cache schema ID
        const schemaId = await computeRoundEndedSchemaId(sdk)
        if (schemaId) {
          setCachedSchemaId(schemaId)

        } else {
          console.warn('⚠️ Failed to compute schema ID')
        }
      } catch (error) {
        console.error('❌ Stream initialization error:', error)
      }
    }

    initializeStreams()
  }, [])
}
