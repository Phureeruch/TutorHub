import { describe, expect, it } from 'vitest'
import { createSeedDb } from '../data/seedData'
import { currentRateOf, subjectNameOf, userNameOf } from './lookups'

const db = createSeedDb(new Date(2026, 10, 12, 8))

describe('lookups', () => {
  it('resolves user names', () => {
    expect(userNameOf(db, 1)).toBe('Alice')
  })

  it('falls back for a missing user', () => {
    expect(userNameOf(db, 999)).toBe('Unknown user')
  })

  it('resolves subject names', () => {
    expect(subjectNameOf(db, 3)).toBe('Calculus I')
  })

  it('falls back for a missing subject', () => {
    expect(subjectNameOf(db, 999)).toBe('Unknown subject')
  })

  it("reads a tutor's current rate", () => {
    expect(currentRateOf(db, 2)).toBe(35)
  })

  it('returns null when a tutor has no profile', () => {
    expect(currentRateOf(db, 3)).toBeNull()
  })
})
