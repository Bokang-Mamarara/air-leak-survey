import 'leaflet/dist/leaflet.css'
import { CRS, latLngBounds } from 'leaflet'
import { useMemo } from 'react'
import { CircleMarker, ImageOverlay, MapContainer, useMapEvents } from 'react-leaflet'
import { PLAN_IMAGE_HEIGHT_PX, PLAN_IMAGE_URL, PLAN_IMAGE_WIDTH_PX } from './planImage'
import { imageXYToLeafletPoint, isWithinPlan, leafletPointToImageXY, type ImageXY } from './coordinates'
import { LEAK_ACCENT_COLOR, OPEN_LINE_ACCENT_COLOR, PENDING_MARKER_COLOR } from '../capture/colors'
import { ZoomControl } from './ZoomControl'

export interface MapMarker {
  id: string
  x: number
  y: number
  isDeliberateOpenLine: boolean
}

interface MapScreenProps {
  markers: MapMarker[]
  pendingXY: ImageXY | null
  onValidTap: (xy: ImageXY) => void
}

function TapHandler({ onTap }: { onTap: (xy: ImageXY) => void }) {
  useMapEvents({
    click(event) {
      const xy = leafletPointToImageXY(event.latlng, PLAN_IMAGE_HEIGHT_PX)
      // maxBounds only constrains panning — a click in the letterboxed margin
      // around the image still fires and must be rejected here, not clamped.
      if (!isWithinPlan(xy.x, xy.y, PLAN_IMAGE_WIDTH_PX, PLAN_IMAGE_HEIGHT_PX)) {
        return
      }
      onTap(xy)
    },
  })
  return null
}

export function MapScreen({ markers, pendingXY, onValidTap }: MapScreenProps) {
  const bounds = useMemo(
    () => latLngBounds([0, 0], [PLAN_IMAGE_HEIGHT_PX, PLAN_IMAGE_WIDTH_PX]),
    [],
  )

  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100%' }}>
      <MapContainer
        crs={CRS.Simple}
        bounds={bounds}
        maxBounds={bounds}
        maxBoundsViscosity={1}
        minZoom={-2}
        // Leaflet's default zoomSnap (1) rounds the fitBounds zoom down to
        // the nearest whole level, which can leave up to a full zoom level
        // of dead margin around the plan and shrink the PS-xx labels well
        // below what the fit could otherwise give. 0 lets fitBounds land on
        // the exact zoom the viewport allows; zoomDelta keeps the (now
        // custom) +/- buttons stepping by a full level.
        zoomSnap={0}
        zoomDelta={1}
        zoomControl={false}
        doubleClickZoom={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%', background: '#0b0f14' }}
      >
        <ImageOverlay url={PLAN_IMAGE_URL} bounds={bounds} />
        <TapHandler onTap={onValidTap} />
        <ZoomControl />

        {markers.map((marker) => (
          <CircleMarker
            key={marker.id}
            center={imageXYToLeafletPoint(marker, PLAN_IMAGE_HEIGHT_PX)}
            radius={8}
            pathOptions={{
              color: '#0b0f14',
              weight: 2,
              fillColor: marker.isDeliberateOpenLine ? OPEN_LINE_ACCENT_COLOR : LEAK_ACCENT_COLOR,
              fillOpacity: 1,
            }}
          />
        ))}

        {pendingXY && (
          <CircleMarker
            center={imageXYToLeafletPoint(pendingXY, PLAN_IMAGE_HEIGHT_PX)}
            radius={10}
            pathOptions={{
              color: '#0b0f14',
              weight: 3,
              fillColor: PENDING_MARKER_COLOR,
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
        {pendingXY
          ? `x: ${Math.round(pendingXY.x)}  y: ${Math.round(pendingXY.y)}`
          : 'tap the plan'}
      </div>
    </div>
  )
}
