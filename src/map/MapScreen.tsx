import 'leaflet/dist/leaflet.css'
import { CRS, latLngBounds, type LatLng } from 'leaflet'
import { useMemo, useState } from 'react'
import { CircleMarker, ImageOverlay, MapContainer, useMapEvents } from 'react-leaflet'
import { PLAN_IMAGE_HEIGHT_PX, PLAN_IMAGE_URL, PLAN_IMAGE_WIDTH_PX } from './planImage'
import { isWithinPlan, leafletPointToImageXY } from './coordinates'

function TapHandler({ onTap }: { onTap: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onTap(event.latlng)
    },
  })
  return null
}

export function MapScreen() {
  const bounds = useMemo(
    () => latLngBounds([0, 0], [PLAN_IMAGE_HEIGHT_PX, PLAN_IMAGE_WIDTH_PX]),
    [],
  )
  const [tapPoint, setTapPoint] = useState<LatLng | null>(null)

  const imageXY = tapPoint ? leafletPointToImageXY(tapPoint, PLAN_IMAGE_HEIGHT_PX) : null

  function handleTap(point: LatLng) {
    const xy = leafletPointToImageXY(point, PLAN_IMAGE_HEIGHT_PX)
    // maxBounds only constrains panning — a click in the letterboxed margin
    // around the image still fires and must be rejected here, not clamped.
    if (!isWithinPlan(xy.x, xy.y, PLAN_IMAGE_WIDTH_PX, PLAN_IMAGE_HEIGHT_PX)) {
      return
    }
    setTapPoint(point)
  }

  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100%' }}>
      <MapContainer
        crs={CRS.Simple}
        bounds={bounds}
        maxBounds={bounds}
        maxBoundsViscosity={1}
        minZoom={-2}
        doubleClickZoom={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%', background: '#0b0f14' }}
      >
        <ImageOverlay url={PLAN_IMAGE_URL} bounds={bounds} />
        <TapHandler onTap={handleTap} />
        {tapPoint && (
          <CircleMarker
            center={tapPoint}
            radius={10}
            pathOptions={{
              color: '#0b0f14',
              weight: 3,
              fillColor: '#e8a33d',
              fillOpacity: 1,
            }}
          />
        )}
      </MapContainer>

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 1000,
          padding: '10px 14px',
          borderRadius: 6,
          background: 'rgba(11, 15, 20, 0.85)',
          color: '#f2f5f8',
          fontFamily: 'monospace',
          fontSize: 16,
          border: '1px solid #3a4757',
        }}
      >
        {imageXY ? `x: ${Math.round(imageXY.x)}  y: ${Math.round(imageXY.y)}` : 'tap the plan'}
      </div>
    </div>
  )
}
