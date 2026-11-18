import { describe, expect, it } from 'vitest'
import { isTeachingLevel, orderLevels } from './levels'

describe('orderLevels', () => {
  it('dedupes and sorts levels into display order', () => {
    expect(orderLevels(['GRADUATE', 'HIGH_SCHOOL', 'GRADUATE'])).toEqual(['HIGH_SCHOOL', 'GRADUATE'])
  })
})

describe('isTeachingLevel', () => {
  it('accepts known levels only', () => {
    expect(isTeachingLevel('UNDERGRADUATE')).toBe(true)
    expect(isTeachingLevel('PHD')).toBe(false)
  })
})
