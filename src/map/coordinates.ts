export interface LeafletPoint {
  lat: number
  lng: number
}

export interface ImageXY {
  x: number
  y: number
}

// Leaflet's CRS.Simple treats lat as increasing upward from the bounds'
// southwest corner, with 1 unit == 1 image pixel. A level plan is read with
// its origin at the top-left, so this flips the vertical axis: lng maps
// straight across to x, and lat is subtracted from the image height to give
// a y that increases downward from the top edge.
export function leafletPointToImageXY(point: LeafletPoint, imageHeightPx: number): ImageXY {
  return {
    x: point.lng,
    y: imageHeightPx - point.lat,
  }
}

// The inverse of leafletPointToImageXY, for rendering a stored or pending
// image-coordinate marker back onto the Leaflet map. Same flip, run backward:
// x maps straight across to lng, and y is subtracted from the image height to
// give a lat that increases upward from the bottom edge.
export function imageXYToLeafletPoint(point: ImageXY, imageHeightPx: number): LeafletPoint {
  return {
    lat: imageHeightPx - point.y,
    lng: point.x,
  }
}

// maxBounds on the Leaflet map constrains panning, not individual click
// events — a click can still land outside the image (e.g. in the letterboxed
// margin around it) and needs to be rejected explicitly. Edges are inclusive:
// a tap exactly on the plan's border frame is still on the plan.
export function isWithinPlan(
  x: number,
  y: number,
  imageWidthPx: number,
  imageHeightPx: number,
): boolean {
  return x >= 0 && x <= imageWidthPx && y >= 0 && y <= imageHeightPx
}
