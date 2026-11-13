import type { MockDb } from '../types/types'

export const userNameOf = (db: MockDb, id: number) => db.users.find((u) => u.id === id)?.name ?? 'Unknown user'

export const subjectNameOf = (db: MockDb, id: number) => db.subjects.find((s) => s.id === id)?.name ?? 'Unknown subject'

/** The tutor's live rate for one subject, or null if they do not teach it. */
export function currentRateOf(db: MockDb, tutorId: number, subjectId: number): number | null {
  const profile = db.tutorProfiles.find((p) => p.userId === tutorId)
  if (!profile) return null
  return db.tutorSubjects.find((ts) => ts.tutorProfileId === profile.id && ts.subjectId === subjectId)?.hourlyPrice ?? null
}
