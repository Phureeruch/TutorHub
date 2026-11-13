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

  it("reads a tutor's current rate for one subject", () => {
    expect(currentRateOf(db, 2, 3)).toBe(350)
    expect(currentRateOf(db, 2, 4)).toBe(380)
  })

  it('returns null for a subject the tutor does not teach', () => {
    expect(currentRateOf(db, 2, 1)).toBeNull()
  })

  it('returns null when a tutor has no profile', () => {
    expect(currentRateOf(db, 3, 1)).toBeNull()
  })
})
