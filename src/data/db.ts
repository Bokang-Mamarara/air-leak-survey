/**
 * Dexie schema for LeakRecord, spec section 7.
 *
 * `equivalentDiameterMm` and `linePressureKpaG` are plain numbers here, unlike
 * the calculation layer's `LeakInput`, where both are nullable overrides. A
 * stored record always has a concrete value — resolved at capture time by
 * `buildLeakRecord` — because Dexie holds what was actually logged, not an
 * input still waiting on a default.
 */

import Dexie, { type Table } from 'dexie'

export type SyncStatus = 'pending' | 'synced' | 'failed'
export type RepairStatus = 'open' | 'scheduled' | 'repaired' | 'verified'

export interface LeakRecord {
  id: string
  levelId: string
  /** Image coordinates on the level plan (src/map/coordinates.ts), never lat/lng. */
  x: number
  y: number
  leakTypeId: string
  /**
   * For a leak (`isDeliberateOpenLine: false`), this is an orifice
   * equivalent — the input `evaluateLeak()` expects. For an open line
   * (`isDeliberateOpenLine: true`), it is a nominal bore read directly off
   * the pipe, a different physical quantity that happens to share this
   * field per spec section 7. Do not pass an open line's value into the
   * orifice model — it was never derived as an orifice equivalent and would
   * rank a ventilation shortfall as if it were leak flow.
   */
  equivalentDiameterMm: number
  linePressureKpaG: number
  /** True for the two spec-section-4 open-line types — a separate category, never totalled with leaks. */
  isDeliberateOpenLine: boolean
  note?: string
  photoBlob?: Blob
  /** ISO string, device clock. Phase 6 known limitation: no protection against clock drift. */
  loggedAt: string
  /** A device tag, not a person — see DECISIONS.md. */
  loggedBy: string
  syncStatus: SyncStatus
  repairStatus: RepairStatus
}

class AirLeakSurveyDatabase extends Dexie {
  leakRecords!: Table<LeakRecord, string>

  constructor() {
    super('air-leak-survey')
    this.version(1).stores({
      leakRecords: 'id, levelId, syncStatus, repairStatus',
    })
  }
}

export const db = new AirLeakSurveyDatabase()
