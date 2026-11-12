import type { MockDb } from '../types/types'

export const userNameOf = (db: MockDb, id: number) => db.users.find((u) => u.id === id)?.name ?? 'Unknown user'

export const subjectNameOf = (db: MockDb, id: number) => db.subjects.find((s) => s.id === id)?.name ?? 'Unknown subject'

export const currentRateOf = (db: MockDb, tutorId: number): number | null =>
  db.tutorProfiles.find((p) => p.userId === tutorId)?.hourlyPrice ?? null
