import { createSeedDb } from '../data/seedData'
import type { MockDb } from '../types/types'

export const STORAGE_KEY = 'tutorhub.mock.v1'
const VERSION = 1

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface AppState {
  db: MockDb
  currentUserId: number | null
}

const seedState = (now: Date): AppState => ({ db: createSeedDb(now), currentUserId: null })

const COLLECTIONS = ['users', 'subjects', 'tutorProfiles', 'tutorSubjects', 'availabilities', 'bookings'] as const
const ID_COUNTERS = ['user', 'tutorProfile', 'tutorSubject', 'availability', 'booking'] as const

/**
 * Shape check for a saved db. A half-valid save would make views throw during
 * render (e.g. a tutor with no profile), so anything off falls back to seed.
 */
function isValidDb(value: unknown): value is MockDb {
  if (typeof value !== 'object' || value === null) return false
  const db = value as Record<string, unknown>
  if (!COLLECTIONS.every((key) => Array.isArray(db[key]))) return false
  if (typeof db.credentials !== 'object' || db.credentials === null) return false
  const ids = db.nextIds as Record<string, unknown> | undefined
  if (typeof ids !== 'object' || ids === null || !ID_COUNTERS.every((key) => Number.isInteger(ids[key]))) return false
  const typed = value as MockDb
  return typed.users
    .filter((u) => u.role === 'TUTOR')
    .every((tutor) => typed.tutorProfiles.some((p) => p.userId === tutor.id))
}

/** Restores the mock database; any unreadable or foreign state falls back to fresh seed data. */
export function loadState(store: KeyValueStore, now: Date): AppState {
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return seedState(now)
    const parsed = JSON.parse(raw) as { version?: number } & Partial<AppState>
    if (parsed.version !== VERSION || !isValidDb(parsed.db)) return seedState(now)
    const db = parsed.db
    const currentUserId = db.users.some((u) => u.id === parsed.currentUserId) ? parsed.currentUserId! : null
    return { db, currentUserId }
  } catch {
    return seedState(now)
  }
}

/**
 * The db as last committed by *any* tab. Every mutation starts from this, so two
 * tabs racing for one slot behave like two requests against one database:
 * the second gets a 409 instead of silently overwriting the first.
 */
export function readLatestDb(store: KeyValueStore, inMemory: MockDb): MockDb {
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return inMemory
    const parsed = JSON.parse(raw) as { version?: number; db?: unknown }
    return parsed.version === VERSION && isValidDb(parsed.db) ? parsed.db : inMemory
  } catch {
    return inMemory
  }
}

export function saveState(store: KeyValueStore, state: AppState): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...state }))
  } catch {
    // Storage can be full or blocked (private mode); the in-memory state still works.
  }
}
