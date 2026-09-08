/**
 * Always-visible sync status chip. Not a toast, not conditional on there
 * being anything pending — a zero-pending queue is itself worth showing, so
 * the queue never goes silent (CLAUDE.md, field constraints).
 */

import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../data/db.ts'
import { SYNC_ENDPOINT } from './constants.ts'
import { retryQueue } from './syncQueue.ts'

const chipStyle = {
  padding: '10px 14px',
  borderRadius: 6,
  background: 'rgba(11, 15, 20, 0.85)',
  color: '#f2f5f8',
  fontFamily: 'monospace',
  fontSize: 14,
  border: '1px solid #3a4757',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
} as const

const retryButtonStyle = {
  minHeight: 48,
  minWidth: 48,
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 13,
  border: '2px solid #3a4757',
  background: '#141b23',
  color: '#f2f5f8',
  cursor: 'pointer',
} as const

const retryButtonDisabledStyle = {
  ...retryButtonStyle,
  color: '#6b7684',
  cursor: 'not-allowed',
} as const

export function SyncQueueBadge() {
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState(0)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    const subscription = liveQuery(() =>
      Promise.all([
        db.leakRecords.where('syncStatus').equals('pending').count(),
        db.leakRecords.where('syncStatus').equals('failed').count(),
      ]),
    ).subscribe({
      next: ([pendingCount, failedCount]) => {
        setPending(pendingCount)
        setFailed(failedCount)
      },
      error: (err: unknown) => console.error('Sync queue count failed', err),
    })

    return () => subscription.unsubscribe()
  }, [])

  const hasEndpoint = SYNC_ENDPOINT != null
  const hasQueue = pending > 0 || failed > 0

  function handleRetry() {
    setRetrying(true)
    retryQueue()
      .catch((err: unknown) => console.error('Retry failed', err))
      .finally(() => setRetrying(false))
  }

  return (
    <div style={chipStyle}>
      <span>
        {pending} pending
        {failed > 0 ? ` · ${failed} failed` : ''}
      </span>
      <button
        type="button"
        style={!hasEndpoint || !hasQueue || retrying ? retryButtonDisabledStyle : retryButtonStyle}
        onClick={handleRetry}
        disabled={!hasEndpoint || !hasQueue || retrying}
        title={hasEndpoint ? 'Retry sending queued records' : 'No sync target configured'}
      >
        {retrying ? '…' : hasEndpoint ? 'Retry' : 'No sync target'}
      </button>
    </div>
  )
}
