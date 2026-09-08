/**
 * Update control for the service worker. registerType is 'prompt' (see
 * vite.config.ts and DECISIONS.md), not 'autoUpdate' — a worker that swaps
 * itself in on its own can replace the running app mid-shift on a signal
 * flicker underground. This chip only appears once a new version is waiting,
 * and only reloads when tapped — same manual-only principle as the sync
 * queue's Retry control.
 */

import { useRegisterSW } from 'virtual:pwa-register/react'

const chipStyle = {
  padding: '10px 14px',
  borderRadius: 6,
  background: 'rgba(232, 163, 61, 0.15)',
  color: '#f2f5f8',
  fontFamily: 'monospace',
  fontSize: 14,
  border: '1px solid #e8a33d',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
} as const

const updateButtonStyle = {
  minHeight: 48,
  minWidth: 48,
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 13,
  border: '2px solid #e8a33d',
  background: '#e8a33d',
  color: '#0b0f14',
  fontWeight: 700,
  cursor: 'pointer',
} as const

export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError: (err: unknown) => console.error('Service worker registration failed', err),
  })

  if (!needRefresh) {
    return null
  }

  return (
    <div style={chipStyle}>
      <span>Update available</span>
      <button
        type="button"
        style={updateButtonStyle}
        onClick={() => updateServiceWorker(true)}
      >
        Reload
      </button>
    </div>
  )
}
