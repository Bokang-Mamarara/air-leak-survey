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
import type { CalcSettings } from '../calc/types.ts'
import type { TariffDraftFields } from '../settings/tariffDraft.ts'

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
  /**
   * Whether `equivalentDiameterMm` came from a typed override or the leak
   * type's catalogue default — recorded here, at capture time, because it is
   * a fact about how the record was made and cannot be reconstructed
   * reliably afterwards (an override that happens to equal the catalogue
   * value would be indistinguishable from the default if this weren't
   * stored). Always `'measured'` for a deliberate open line: its bore has no
   * catalogue default to fall back to, so the capture flow requires it be
   * typed in every time. See `buildLeakRecord.ts`.
   */
  diameterProvenance: 'measured' | 'catalogue'
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

/** Fixed id of the one settings row this app ever stores. */
export const SETTINGS_ROW_ID = 'singleton'

/**
 * The settings table's one row: `CalcSettings` as it exists, plus a place to
 * hold a tariff still being typed in. `tariffDraft` is not part of
 * `CalcSettings` and never reaches `evaluateLeak` or `cost.ts` — it exists so
 * navigating away from a half-filled tariff form does not discard it, while
 * `settings.tariff` stays `null` (see `src/settings/tariffDraft.ts`) until
 * every field validates.
 */
export interface StoredSettingsRow {
  id: string
  settings: CalcSettings
  tariffDraft?: TariffDraftFields
}

class AirLeakSurveyDatabase extends Dexie {
  leakRecords!: Table<LeakRecord, string>
  settings!: Table<StoredSettingsRow, string>

  constructor() {
    super('air-leak-survey')
    this.version(1).stores({
      leakRecords: 'id, levelId, syncStatus, repairStatus',
    })
    // Adds the settings table only. Existing leakRecords are untouched by
    // this upgrade — Dexie carries them forward unchanged into version 2.
    this.version(2).stores({
      leakRecords: 'id, levelId, syncStatus, repairStatus',
      settings: 'id',
    })
  }
}

export const db = new AirLeakSurveyDatabase()
