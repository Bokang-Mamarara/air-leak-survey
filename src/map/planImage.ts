// Level 24 plan — placeholder schematic. Source: public/plans/level-24.svg,
// rasterized to PNG for use as a Leaflet imageOverlay.
export const PLAN_IMAGE_URL = '/plans/level-24.png'

// Pixel dimensions of level-24.png, matching the SVG's width/height attributes.
export const PLAN_IMAGE_WIDTH_PX = 2000
export const PLAN_IMAGE_HEIGHT_PX = 1200

// Identifies this level's records in Dexie (LeakRecord.levelId) and is the
// query key CaptureScreen loads markers by. There is no level-switching UI
// yet, so this is the only level a record can be logged against.
export const LEVEL_ID = 'level-24'
