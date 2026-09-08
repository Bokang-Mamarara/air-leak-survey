/**
 * Sync queue. `attemptSync` is pure I/O with no framework dependency — same
 * discipline as src/calc, and for the same reason: it is the one place a
 * network failure must not become a React error or a lost record, so it is
 * kept small enough to unit test directly (syncQueue.test.ts), the way
 * src/data/buildLeakRecord.ts is unit tested rather than only exercised
 * through the UI (see DECISIONS.md, 2026-09-08).
 *
 * `retryQueue` is the one function here that touches Dexie. It is called
 * only from a user tap (SyncQueueBadge's Retry control) — never from a
 * background timer or a render — per CLAUDE.md rule 6 and the "no automatic
 * retry loop" constraint for this phase.
 */

import { db, type LeakRecord, type SyncStatus } from '../data/db.ts'
import { SYNC_ENDPOINT } from './constants.ts'

/**
 * Attempts to sync a single record. Never throws — every path resolves to a
 * status the caller can persist. `endpoint` defaults to the configured
 * SYNC_ENDPOINT; the parameter exists so this can be unit tested against a
 * fake endpoint without touching the constants module.
 *
 * - No endpoint configured: resolves 'pending'. This is the expected state
 *   for the life of this project (no backend), not an error.
 * - Endpoint configured, request throws (offline, DNS, etc.) or responds
 *   non-2xx: resolves 'failed'.
 * - Endpoint configured, response ok: resolves 'synced'.
 */
export async function attemptSync(
  record: LeakRecord,
  endpoint: string | null = SYNC_ENDPOINT,
): Promise<SyncStatus> {
  if (endpoint == null) {
    return 'pending'
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    return response.ok ? 'synced' : 'failed'
  } catch (err) {
    console.error('Sync attempt failed', err)
    return 'failed'
  }
}

/**
 * Retries every pending or failed record once. Fires all attempts
 * concurrently and writes back whatever status each one resolves to —
 * including 'pending' again, when there is still no endpoint configured, so
 * this is a safe no-op rather than something that needs its own guard at
 * the call site.
 */
export async function retryQueue(): Promise<void> {
  const records = await db.leakRecords.where('syncStatus').anyOf('pending', 'failed').toArray()

  await Promise.allSettled(
    records.map(async (record) => {
      const status = await attemptSync(record)
      if (status !== record.syncStatus) {
        await db.leakRecords.update(record.id, { syncStatus: status })
      }
    }),
  )
}
