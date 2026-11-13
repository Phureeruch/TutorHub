import type { TeachingLevel } from '../types/types'

/** Display order, also the order levels are stored in. */
export const TEACHING_LEVELS: readonly TeachingLevel[] = ['HIGH_SCHOOL', 'UNDERGRADUATE', 'GRADUATE']

export const LEVEL_LABEL: Record<TeachingLevel, string> = {
  HIGH_SCHOOL: 'High school',
  UNDERGRADUATE: 'Undergraduate',
  GRADUATE: 'Graduate',
}

export const isTeachingLevel = (value: unknown): value is TeachingLevel =>
  TEACHING_LEVELS.includes(value as TeachingLevel)

/** Deduped, in display order, so every screen and every save lists levels the same way. */
export const orderLevels = (levels: readonly TeachingLevel[]): TeachingLevel[] =>
  TEACHING_LEVELS.filter((level) => levels.includes(level))
