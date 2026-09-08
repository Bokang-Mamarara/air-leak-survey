import { describe, expect, it } from 'vitest'
import { isWithinPlan, leafletPointToImageXY } from './coordinates'

// Bounds used by MapScreen: southWest [0, 0], northEast [height, width].
// Leaflet lat increases upward; image y increases downward from the top.
const imageHeightPx = 1200

describe('leafletPointToImageXY', () => {
  it('maps the top-left Leaflet corner to image origin (0, 0)', () => {
    expect(leafletPointToImageXY({ lat: imageHeightPx, lng: 0 }, imageHeightPx)).toEqual({
      x: 0,
      y: 0,
    })
  })

  it('maps the bottom-left Leaflet corner to image (0, height)', () => {
    expect(leafletPointToImageXY({ lat: 0, lng: 0 }, imageHeightPx)).toEqual({
      x: 0,
      y: imageHeightPx,
    })
  })

  it('maps the top-right Leaflet corner to image (width, 0)', () => {
    expect(leafletPointToImageXY({ lat: imageHeightPx, lng: 2000 }, imageHeightPx)).toEqual({
      x: 2000,
      y: 0,
    })
  })

  it('maps the bottom-right Leaflet corner to image (width, height)', () => {
    expect(leafletPointToImageXY({ lat: 0, lng: 2000 }, imageHeightPx)).toEqual({
      x: 2000,
      y: imageHeightPx,
    })
  })

  it('flips a mid-height point, leaving x unchanged', () => {
    expect(leafletPointToImageXY({ lat: 300, lng: 860 }, imageHeightPx)).toEqual({
      x: 860,
      y: 900,
    })
  })
})

const imageWidthPx = 2000

describe('isWithinPlan', () => {
  it('accepts an interior point', () => {
    expect(isWithinPlan(860, 300, imageWidthPx, imageHeightPx)).toBe(true)
  })

  it('accepts the exact top-left edge (0, 0)', () => {
    expect(isWithinPlan(0, 0, imageWidthPx, imageHeightPx)).toBe(true)
  })

  it('accepts the exact bottom-right edge (width, height)', () => {
    expect(isWithinPlan(imageWidthPx, imageHeightPx, imageWidthPx, imageHeightPx)).toBe(true)
  })

  it('accepts the exact top-right edge (width, 0)', () => {
    expect(isWithinPlan(imageWidthPx, 0, imageWidthPx, imageHeightPx)).toBe(true)
  })

  it('accepts the exact bottom-left edge (0, height)', () => {
    expect(isWithinPlan(0, imageHeightPx, imageWidthPx, imageHeightPx)).toBe(true)
  })

  it('rejects a point just past the right edge', () => {
    expect(isWithinPlan(imageWidthPx + 1, 300, imageWidthPx, imageHeightPx)).toBe(false)
  })

  it('rejects a point far past the right edge, matching the reported defect', () => {
    expect(isWithinPlan(2190, 300, imageWidthPx, imageHeightPx)).toBe(false)
  })

  it('rejects a point just past the bottom edge', () => {
    expect(isWithinPlan(860, imageHeightPx + 1, imageWidthPx, imageHeightPx)).toBe(false)
  })

  it('rejects a negative x', () => {
    expect(isWithinPlan(-1, 300, imageWidthPx, imageHeightPx)).toBe(false)
  })

  it('rejects a negative y', () => {
    expect(isWithinPlan(860, -1, imageWidthPx, imageHeightPx)).toBe(false)
  })
})
