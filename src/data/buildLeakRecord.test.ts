import { describe, expect, it } from 'vitest'
import { DEFAULT_LINE_PRESSURE_KPA_G, LEAK_TYPE_CATALOGUE } from '../calc/constants.ts'
import { buildLeakRecord } from './buildLeakRecord.ts'

const failedCoupling = LEAK_TYPE_CATALOGUE.find((type) => type.id === 'failed-hose-coupling')!
const refugeBay = LEAK_TYPE_CATALOGUE.find(
  (type) => type.id === 'refuge-bay-self-ventilation',
)!
const openLineCooling = LEAK_TYPE_CATALOGUE.find((type) => type.id === 'open-line-for-cooling')!

const baseInput = {
  id: 'test-id',
  levelId: 'level-24',
  x: 100,
  y: 200,
  loggedAt: '2026-09-08T12:00:00.000Z',
  loggedBy: 'device-abc',
}

describe('buildLeakRecord', () => {
  it('uses the catalogue diameter for a leak type with no override', () => {
    const record = buildLeakRecord({ ...baseInput, leakType: failedCoupling })
    expect(record.equivalentDiameterMm).toBe(3)
    expect(record.isDeliberateOpenLine).toBe(false)
    expect(record.leakTypeId).toBe('failed-hose-coupling')
  })

  it('an override diameter wins over the catalogue default', () => {
    const record = buildLeakRecord({
      ...baseInput,
      leakType: failedCoupling,
      diameterOverrideMm: 5,
    })
    expect(record.equivalentDiameterMm).toBe(5)
  })

  it('records diameterProvenance as catalogue when no override is given, measured when one is', () => {
    const catalogueRecord = buildLeakRecord({ ...baseInput, leakType: failedCoupling })
    expect(catalogueRecord.diameterProvenance).toBe('catalogue')

    const measuredRecord = buildLeakRecord({
      ...baseInput,
      leakType: failedCoupling,
      diameterOverrideMm: 5,
    })
    expect(measuredRecord.diameterProvenance).toBe('measured')
  })

  it('an override equal to the catalogue default is still recorded as measured', () => {
    // The case a "compare the stored value to the catalogue default"
    // reconstruction would get wrong: provenance is a fact about how the
    // record was made, not something derivable from the value alone.
    const record = buildLeakRecord({
      ...baseInput,
      leakType: failedCoupling,
      diameterOverrideMm: failedCoupling.equivalentDiameterMm as number,
    })
    expect(record.equivalentDiameterMm).toBe(failedCoupling.equivalentDiameterMm)
    expect(record.diameterProvenance).toBe('measured')
  })

  it('an open line is always recorded as measured — it has no catalogue default to fall back to', () => {
    const record = buildLeakRecord({
      ...baseInput,
      leakType: refugeBay,
      diameterOverrideMm: 40,
    })
    expect(record.diameterProvenance).toBe('measured')
  })

  it('throws rather than inventing a diameter for an open line with no override', () => {
    expect(() => buildLeakRecord({ ...baseInput, leakType: refugeBay })).toThrow()
  })

  it('throws rather than accepting a zero or negative diameter', () => {
    expect(() =>
      buildLeakRecord({ ...baseInput, leakType: failedCoupling, diameterOverrideMm: 0 }),
    ).toThrow()
    expect(() =>
      buildLeakRecord({ ...baseInput, leakType: failedCoupling, diameterOverrideMm: -3 }),
    ).toThrow()
  })

  it('an open line with a supplied bore builds a record, marked as an open line', () => {
    const record = buildLeakRecord({
      ...baseInput,
      leakType: openLineCooling,
      diameterOverrideMm: 20,
    })
    expect(record.equivalentDiameterMm).toBe(20)
    expect(record.isDeliberateOpenLine).toBe(true)
    expect(record.leakTypeId).toBe('open-line-for-cooling')
  })

  it('an open-line record carries isDeliberateOpenLine true alongside its bore — a guard for Phase 5, which must not read this value into the orifice model', () => {
    const record = buildLeakRecord({
      ...baseInput,
      leakType: refugeBay,
      diameterOverrideMm: 40,
    })
    expect(record.isDeliberateOpenLine).toBe(true)
    expect(record.equivalentDiameterMm).toBe(40)
  })

  it('every catalogue type maps its category to isDeliberateOpenLine correctly', () => {
    for (const type of LEAK_TYPE_CATALOGUE) {
      const record = buildLeakRecord({
        ...baseInput,
        leakType: type,
        diameterOverrideMm: type.equivalentDiameterMm ?? 20,
      })
      expect(record.isDeliberateOpenLine).toBe(type.category === 'deliberate-open-line')
    }
  })

  it('defaults line pressure from the named constant when no override is given', () => {
    const record = buildLeakRecord({ ...baseInput, leakType: failedCoupling })
    expect(record.linePressureKpaG).toBe(DEFAULT_LINE_PRESSURE_KPA_G)
  })

  it('an overridden line pressure wins over the default', () => {
    const record = buildLeakRecord({
      ...baseInput,
      leakType: failedCoupling,
      linePressureKpaGOverride: 450,
    })
    expect(record.linePressureKpaG).toBe(450)
  })

  it('always writes syncStatus pending and repairStatus open', () => {
    const record = buildLeakRecord({ ...baseInput, leakType: failedCoupling })
    expect(record.syncStatus).toBe('pending')
    expect(record.repairStatus).toBe('open')
  })

  it('carries id, levelId, position, timestamp and device tag through unchanged', () => {
    const record = buildLeakRecord({ ...baseInput, leakType: failedCoupling })
    expect(record.id).toBe('test-id')
    expect(record.levelId).toBe('level-24')
    expect(record.x).toBe(100)
    expect(record.y).toBe(200)
    expect(record.loggedAt).toBe('2026-09-08T12:00:00.000Z')
    expect(record.loggedBy).toBe('device-abc')
  })

  it('note is passed through when given and left undefined when not', () => {
    const withNote = buildLeakRecord({
      ...baseInput,
      leakType: failedCoupling,
      note: 'near split set',
    })
    expect(withNote.note).toBe('near split set')

    const withoutNote = buildLeakRecord({ ...baseInput, leakType: failedCoupling })
    expect(withoutNote.note).toBeUndefined()
  })
})
