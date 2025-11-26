/**
 * Streams Cache - Manages schema ID caching and sync state
 * Computed schema ID is cached locally to avoid repeated computation
 */

let cachedSchemaId: string | null = null
let cacheInitialized = false

// For tracking round sync state
export interface SyncState {
  latestStreamRoundId: bigint | null
  currentContractRoundId: bigint | null
  isSynced: boolean
  missingRounds: bigint[]
}

let syncState: SyncState = {
  latestStreamRoundId: null,
  currentContractRoundId: null,
  isSynced: false,
  missingRounds: []
}

/**
 * Set cached schema ID (typically on app initialization)
 */
export function setCachedSchemaId(schemaId: string) {
  cachedSchemaId = schemaId
  cacheInitialized = true

}

/**
 * Get cached schema ID
 */
export function getCachedSchemaId(): string | null {
  return cachedSchemaId
}

/**
 * Check if schema ID is cached
 */
export function isSchemaIdCached(): boolean {
  return cacheInitialized && cachedSchemaId !== null
}

/**
 * Update sync state with round information
 */
export function updateSyncState(newState: Partial<SyncState>) {
  syncState = { ...syncState, ...newState }
  
  // Auto-calculate if synced
  if (syncState.currentContractRoundId !== null && syncState.latestStreamRoundId !== null) {
    syncState.isSynced = syncState.currentContractRoundId === syncState.latestStreamRoundId + BigInt(1)
    
    // Calculate missing rounds
    if (!syncState.isSynced) {
      const missing: bigint[] = []
      for (let i = syncState.latestStreamRoundId! + BigInt(1); i < syncState.currentContractRoundId!; i++) {
        missing.push(i)
      }
      syncState.missingRounds = missing
    } else {
      syncState.missingRounds = []
    }
  }
}

/**
 * Get current sync state
 */
export function getSyncState(): SyncState {
  return { ...syncState }
}

/**
 * Reset sync state (useful for testing)
 */
export function resetSyncState() {
  syncState = {
    latestStreamRoundId: null,
    currentContractRoundId: null,
    isSynced: false,
    missingRounds: []
  }
}

/**
 * Check if we need to fetch missing rounds from Logs API
 */
export function needsSync(): boolean {
  return !syncState.isSynced && syncState.missingRounds.length > 0
}

/**
 * Get missing round IDs to fetch from Logs API
 */
export function getMissingRounds(): bigint[] {
  return [...syncState.missingRounds]
}
