import { render } from '@testing-library/react'
import App from '../App'
import { saveState } from '../context/persistence'
import { createSeedDb } from '../data/seedData'
import type { MockDb } from '../types/types'

export const SEED = {
  ALICE: 1,
  BOB: 2,
  CHARLIE: 3,
  DIANA: 4,
  ADMIN: 5,
} as const

/** Mounts the whole app at `path` with `db` already saved, as if the user had reloaded. */
export function renderAppAt(path: string, currentUserId: number | null, db: MockDb = createSeedDb(new Date())) {
  window.localStorage.clear()
  saveState(window.localStorage, { db, currentUserId })
  window.history.replaceState(null, '', path)
  return render(<App />)
}
