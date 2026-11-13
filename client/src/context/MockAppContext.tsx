import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from '../api/mockApi'
import { createSeedDb } from '../data/seedData'
import type { MockDb, User } from '../types/types'
import { MockAppContext, type MockAppValue } from './appContext'
import { loadState, readLatestDb, saveState, STORAGE_KEY, type AppState, type KeyValueStore } from './persistence'

// Long enough to show the "processing payment" state, short enough not to annoy.
const MOCK_PAYMENT_DELAY_MS = 700

function browserStore(): KeyValueStore {
  try {
    return window.localStorage
  } catch {
    const memory = new Map<string, string>()
    return { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) }
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function MockAppProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => browserStore(), [])
  const [state, setState] = useState<AppState>(() => loadState(store, new Date()))
  const [simulateConflict, setSimulateConflict] = useState(false)
  // Actions read the latest state from here so back-to-back async calls never
  // compute from a stale render's snapshot.
  const stateRef = useRef(state)

  const commit = useCallback(
    (next: AppState) => {
      stateRef.current = next
      setState(next)
      saveState(store, next)
    },
    [store],
  )

  const actor = useCallback((): User => {
    const { db, currentUserId } = stateRef.current
    const user = db.users.find((u) => u.id === currentUserId)
    if (!user) throw new api.ApiError(401, 'Sign in to continue.')
    return user
  }, [])

  const mutate = useCallback(
    <T,>(fn: (db: MockDb) => api.Mutation<T>): T => {
      const result = fn(readLatestDb(store, stateRef.current.db))
      commit({ ...stateRef.current, db: result.db })
      return result.data
    },
    [commit, store],
  )

  // Another tab committed: show its data here. The signed-in user stays per tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const db = readLatestDb(store, stateRef.current.db)
      if (db === stateRef.current.db) return
      const next = { ...stateRef.current, db }
      stateRef.current = next
      setState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [store])

  const value = useMemo<MockAppValue>(() => {
    const currentUser = state.db.users.find((u) => u.id === state.currentUserId) ?? null
    return {
      db: state.db,
      currentUser,
      simulateConflict,
      setSimulateConflict,

      login: async (email, password) => {
        const user = api.login(readLatestDb(store, stateRef.current.db), email, password)
        commit({ ...stateRef.current, currentUserId: user.id })
        return user
      },
      logout: () => commit({ ...stateRef.current, currentUserId: null }),
      registerStudent: async (req) => {
        const user = mutate((db) => api.registerStudent(db, req, new Date()))
        commit({ ...stateRef.current, currentUserId: user.id })
        return user
      },
      verifyEmail: async () => {
        const me = actor()
        return mutate((db) => api.verifyEmail(db, me.id, new Date()))
      },
      resetPassword: async (email, newPassword) => {
        mutate((db) => api.resetPassword(db, email, newPassword))
      },
      switchDemoUser: (userId) => commit({ ...stateRef.current, currentUserId: userId }),

      updateTutorProfile: async (req) => {
        const me = actor()
        return mutate((db) => api.updateTutorProfile(db, me, req, new Date()))
      },
      createAvailability: async (req) => {
        const me = actor()
        return mutate((db) => api.createAvailability(db, me, req, new Date()))
      },
      deleteAvailability: async (id) => {
        const me = actor()
        mutate((db) => api.deleteAvailability(db, me, id))
      },

      createBookingWithMockPayment: async (req) => {
        const me = actor()
        await wait(MOCK_PAYMENT_DELAY_MS)
        // The whole check-pay-insert step runs on the state as it is *now*,
        // after the delay, like the server's serialisable transaction.
        return mutate((db) => api.createBooking(db, me, req, { now: new Date(), simulateConflict }))
      },
      resetToSeedData: () => {
        setSimulateConflict(false)
        commit({ db: createSeedDb(new Date()), currentUserId: stateRef.current.currentUserId })
      },
    }
  }, [state, simulateConflict, commit, mutate, actor, store])

  return <MockAppContext.Provider value={value}>{children}</MockAppContext.Provider>
}
