import { describe, expect, it } from 'vitest'
import { LEAK_TYPE_CATALOGUE } from '../calc/constants.ts'
import { getLeakType, LEAK_TYPES, OPEN_LINE_TYPES } from './leakTypes.ts'

describe('LEAK_TYPES / OPEN_LINE_TYPES', () => {
  it('splits the catalogue into six leaks and two open lines', () => {
    expect(LEAK_TYPES).toHaveLength(6)
    expect(OPEN_LINE_TYPES).toHaveLength(2)
  })

  it('together cover every catalogue id exactly once', () => {
    const ids = [...LEAK_TYPES, ...OPEN_LINE_TYPES].map((type) => type.id).sort()
    const catalogueIds = LEAK_TYPE_CATALOGUE.map((type) => type.id).sort()
    expect(ids).toEqual(catalogueIds)
  })

  it('LEAK_TYPES holds only the leak category', () => {
    expect(LEAK_TYPES.every((type) => type.category === 'leak')).toBe(true)
  })

  it('OPEN_LINE_TYPES holds only the deliberate-open-line category', () => {
    expect(OPEN_LINE_TYPES.every((type) => type.category === 'deliberate-open-line')).toBe(true)
  })
})

describe('getLeakType', () => {
  it('finds a known type by id', () => {
    expect(getLeakType('failed-hose-coupling').label).toBe('Failed hose coupling')
  })

  it('throws on an unknown id', () => {
    expect(() => getLeakType('not-a-real-type')).toThrow(/Unknown leak type/)
  })
})
