import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LeakRecord } from '../data/db.ts'
import { attemptSync } from './syncQueue.ts'

const record: LeakRecord = {
  id: 'test-id',
  levelId: 'level-24',
  x: 100,
  y: 200,
  leakTypeId: 'failed-hose-coupling',
  equivalentDiameterMm: 3,
  diameterProvenance: 'catalogue',
  linePressureKpaG: 500,
  isDeliberateOpenLine: false,
  loggedAt: '2026-09-08T12:00:00.000Z',
  loggedBy: 'device-abc',
  syncStatus: 'pending',
  repairStatus: 'open',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('attemptSync', () => {
  it('resolves pending and never calls fetch when no endpoint is configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(attemptSync(record, null)).resolves.toBe('pending')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('resolves failed, without throwing, when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    await expect(attemptSync(record, 'https://example.test/sync')).resolves.toBe('failed')
  })

  it('resolves failed on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    )

    await expect(attemptSync(record, 'https://example.test/sync')).resolves.toBe('failed')
  })

  it('resolves synced on an ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))

    await expect(attemptSync(record, 'https://example.test/sync')).resolves.toBe('synced')
  })

  it('POSTs the record as JSON to the given endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    await attemptSync(record, 'https://example.test/sync')

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.test/sync',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }),
    )
  })
})
