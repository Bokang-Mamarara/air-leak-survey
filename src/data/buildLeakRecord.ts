/**
 * Turns a capture-flow selection into a LeakRecord.
 *
 * This is the one place a tap-plan-tap-type-tap-save selection turns into
 * stored data, and it is where two domain rules get enforced rather than
 * trusted to the UI:
 *
 *   - category -> isDeliberateOpenLine is computed here, not passed in, so a
 *     leak cannot be saved marked as an open line or vice versa.
 *   - an open line with no catalogue diameter and no supplied bore throws
 *     rather than falling back to an invented number. The caller (the
 *     capture screen) is expected to have required the bore field before
 *     Save is reachable for that case; this function is the backstop.
 */

import { DEFAULT_LINE_PRESSURE_KPA_G } from '../calc/constants.ts'
import type { LeakTypeDefinition } from '../calc/types.ts'
import type { LeakRecord } from './db.ts'

export interface BuildLeakRecordInput {
  id: string
  levelId: string
  x: number
  y: number
  leakType: LeakTypeDefinition
  /** Measured bore or override, mm. Required when the type has no catalogue default. */
  diameterOverrideMm?: number | null
  linePressureKpaGOverride?: number | null
  note?: string
  /** ISO string, from the device clock at the moment of save. */
  loggedAt: string
  loggedBy: string
}

export function buildLeakRecord(input: BuildLeakRecordInput): LeakRecord {
  // `??` takes the left side unless it is null or undefined, so a genuine
  // zero-mm override is not mistaken for "no override given" — it is caught
  // by the <= 0 check below instead, since a zero diameter is not absent, it
  // is wrong: zero flow, zero cost, the plausible-wrong-number failure mode.
  const equivalentDiameterMm = input.diameterOverrideMm ?? input.leakType.equivalentDiameterMm

  if (equivalentDiameterMm == null) {
    throw new Error(
      `${input.leakType.label} has no catalogue diameter and none was supplied — ` +
        'the bore must be entered before this record can be built.',
    )
  }

  if (equivalentDiameterMm <= 0) {
    throw new Error(
      `${input.leakType.label} has a diameter of ${equivalentDiameterMm}mm — ` +
        'a real bore or orifice equivalent must be greater than zero.',
    )
  }

  return {
    id: input.id,
    levelId: input.levelId,
    x: input.x,
    y: input.y,
    leakTypeId: input.leakType.id,
    equivalentDiameterMm,
    linePressureKpaG: input.linePressureKpaGOverride ?? DEFAULT_LINE_PRESSURE_KPA_G,
    isDeliberateOpenLine: input.leakType.category === 'deliberate-open-line',
    note: input.note,
    loggedAt: input.loggedAt,
    loggedBy: input.loggedBy,
    syncStatus: 'pending',
    repairStatus: 'open',
  }
}
