import { describe, expect, it } from 'vitest'
import { ApiError, createBooking, verifyEmail } from '../api/mockApi'
import { createSeedDb } from '../data/seedData'
import { loadState, readLatestDb, saveState, STORAGE_KEY, type KeyValueStore } from './persistence'

const NOW = new Date(2026, 10, 12, 8, 0)

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

describe('loadState', () => {
  it('falls back to seed data with nobody signed in when storage is empty', () => {
    const state = loadState(memoryStore(), NOW)
    expect(state.db).toEqual(createSeedDb(NOW))
    expect(state.currentUserId).toBeNull()
  })

  it('falls back to seed data when storage holds corrupt JSON', () => {
    expect(loadState(memoryStore({ [STORAGE_KEY]: '{oops' }), NOW).db).toEqual(createSeedDb(NOW))
  })

  it('falls back to seed data when the saved version is unknown', () => {
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ version: 0, db: {}, currentUserId: 1 }) })
    expect(loadState(store, NOW).currentUserId).toBeNull()
  })

  it('falls back to seed data when storage access throws', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {},
    }
    expect(loadState(throwing, NOW).db).toEqual(createSeedDb(NOW))
  })

  it.each([
    ['tutorProfiles missing', (db: Record<string, unknown>) => delete db.tutorProfiles],
    ['subjects not an array', (db: Record<string, unknown>) => (db.subjects = {})],
    ['nextIds missing a key', (db: Record<string, unknown>) => delete (db.nextIds as Record<string, unknown>).booking],
    ['credentials missing', (db: Record<string, unknown>) => delete db.credentials],
  ])('falls back to seed data when the save has %s', (_label, corrupt) => {
    const store = memoryStore()
    const db = structuredClone(createSeedDb(NOW)) as unknown as Record<string, unknown>
    corrupt(db)
    store.setItem(STORAGE_KEY, JSON.stringify({ version: 1, db, currentUserId: 3 }))
    const state = loadState(store, NOW)
    expect(state.db).toEqual(createSeedDb(NOW))
    expect(state.currentUserId).toBeNull()
  })

  it('round-trips a saved state', () => {
    const store = memoryStore()
    const db = createSeedDb(NOW)
    saveState(store, { db, currentUserId: 3 })
    expect(loadState(store, NOW)).toEqual({ db, currentUserId: 3 })
  })

  it('drops a saved session whose user no longer exists', () => {
    const store = memoryStore()
    saveState(store, { db: createSeedDb(NOW), currentUserId: 999 })
    expect(loadState(store, NOW).currentUserId).toBeNull()
  })
})

describe('readLatestDb (multi-tab consistency)', () => {
  const partial = { tutorId: 1, subjectId: 1, startTime: new Date(2026, 10, 13, 10, 30).toISOString(), durationHours: 1 }

  it("gives a stale tab the other tab's committed booking, so its own attempt is a 409", () => {
    const store = memoryStore()
    const seed = createSeedDb(NOW)
    const tabB = verifyEmail(seed, 4, NOW).db // tab B: Diana, verified, never sees tab A's write
    saveState(store, { db: tabB, currentUserId: 4 })

    // Tab A (Charlie) books 10:30 on the latest stored db and saves.
    const tabA = createBooking(readLatestDb(store, seed), seed.users[2], partial, { now: NOW })
    saveState(store, { db: tabA.db, currentUserId: 3 })

    // Tab B still holds its stale db in memory but must decide against the stored one.
    const latest = readLatestDb(store, tabB)
    const diana = latest.users.find((u) => u.id === 4)!
    expect(() => createBooking(latest, diana, partial, { now: NOW })).toThrow(
      expect.objectContaining({ constructor: ApiError, status: 409 }),
    )
    expect(latest.bookings.some((b) => b.id === tabA.data.id)).toBe(true)
  })

  it('falls back to the in-memory db when storage holds nothing usable', () => {
    const inMemory = createSeedDb(NOW)
    expect(readLatestDb(memoryStore({ [STORAGE_KEY]: '{oops' }), inMemory)).toBe(inMemory)
  })
})

describe('saveState', () => {
  it('swallows storage errors so the app keeps working in private mode', () => {
    const throwing: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(() => saveState(throwing, { db: createSeedDb(NOW), currentUserId: null })).not.toThrow()
  })
})
