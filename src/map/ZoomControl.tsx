/**
 * Custom zoom control. Leaflet's default zoomControl renders ~30px buttons
 * — below the 48px field constraint (CLAUDE.md) — and it defaults to the
 * top-left corner, the same corner as the x/y readout chip, so the two
 * stacked and covered each other. This replaces it entirely: bottom-right,
 * a corner no other overlay (readout chip top-left; sync/update badges
 * top-right) uses.
 */

import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'

const buttonStyle = {
  minHeight: 48,
  minWidth: 48,
  borderRadius: 6,
  fontSize: 22,
  lineHeight: 1,
  border: '1px solid #3a4757',
  background: 'rgba(11, 15, 20, 0.85)',
  color: '#f2f5f8',
  cursor: 'pointer',
} as const

const buttonDisabledStyle = {
  ...buttonStyle,
  color: '#6b7684',
  cursor: 'not-allowed',
} as const

export function ZoomControl() {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom())
    map.on('zoomend', onZoom)
    return () => {
      map.off('zoomend', onZoom)
    }
  }, [map])

  const atMax = zoom >= map.getMaxZoom()
  const atMin = zoom <= map.getMinZoom()

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        type="button"
        aria-label="Zoom in"
        style={atMax ? buttonDisabledStyle : buttonStyle}
        disabled={atMax}
        onClick={() => map.zoomIn()}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        style={atMin ? buttonDisabledStyle : buttonStyle}
        disabled={atMin}
        onClick={() => map.zoomOut()}
      >
        −
      </button>
    </div>
  )
}
