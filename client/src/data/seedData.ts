import type { Availability, Booking, MockDb, Role, User } from '../types/types'

export const SEED_PASSWORD = 'password123'

export interface SeedAccount {
  name: string
  email: string
  role: Role
  note: string
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  { name: 'Charlie', email: 'charlie@tutorhub.dev', role: 'STUDENT', note: 'Verified student' },
  { name: 'Diana', email: 'diana@tutorhub.dev', role: 'STUDENT', note: 'Not verified yet' },
  { name: 'Alice', email: 'alice@tutorhub.dev', role: 'TUTOR', note: 'Python, Data Structures' },
  { name: 'Bob', email: 'bob@tutorhub.dev', role: 'TUTOR', note: 'Calculus I, Linear Algebra' },
  { name: 'Admin User', email: 'admin@tutorhub.dev', role: 'ADMIN', note: 'School administrator' },
]

/** Local date `dayOffset` days after `now`, at hh:mm. */
function at(now: Date, dayOffset: number, hours: number, minutes = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hours, minutes)
  return d.toISOString()
}

/**
 * Builds the SRS §9 seed data. Dates are relative to `now` so the demo windows
 * are always in the future (availability must be future-dated, SDS §4.2).
 */
export function createSeedDb(now: Date = new Date()): MockDb {
  const stamp = now.toISOString()

  const user = (
    id: number,
    name: string,
    email: string,
    role: Role,
    isEmailVerified: boolean,
  ): User => ({
    id,
    name,
    email,
    role,
    isEmailVerified,
    isApproved: role !== 'STUDENT',
    createdAt: stamp,
    updatedAt: stamp,
  })

  const users: User[] = [
    user(1, 'Alice', 'alice@tutorhub.dev', 'TUTOR', true),
    user(2, 'Bob', 'bob@tutorhub.dev', 'TUTOR', true),
    user(3, 'Charlie', 'charlie@tutorhub.dev', 'STUDENT', true),
    user(4, 'Diana', 'diana@tutorhub.dev', 'STUDENT', false),
    user(5, 'Admin User', 'admin@tutorhub.dev', 'ADMIN', true),
  ]

  const availability = (id: number, tutorId: number, startTime: string, endTime: string): Availability => ({
    id,
    tutorId,
    startTime,
    endTime,
    createdAt: stamp,
    updatedAt: stamp,
  })

  // Blocks marked "sliced" are what remains after the seed bookings below were
  // carved out of a larger window, exactly as BR-06 slicing would leave them.
  const availabilities: Availability[] = [
    availability(1, 1, at(now, 1, 9, 30), at(now, 1, 12, 30)), // Alice, the 3h :30 demo window
    availability(2, 1, at(now, 2, 13), at(now, 2, 14)), // Alice, sliced (before booking 1)
    availability(3, 1, at(now, 2, 15), at(now, 2, 17)), // Alice, sliced (after booking 1)
    availability(4, 2, at(now, 1, 10), at(now, 1, 12)), // Bob
    availability(5, 2, at(now, 2, 13, 30), at(now, 2, 16, 30)), // Bob, overlaps Charlie's lesson with Alice (BR-07 demo)
    availability(6, 2, at(now, 4, 9), at(now, 4, 10)), // Bob, sliced (before booking 2)
    availability(7, 2, at(now, 4, 12), at(now, 4, 13)), // Bob, sliced (after booking 2)
  ]

  const booking = (
    fields: Pick<
      Booking,
      'id' | 'studentId' | 'tutorId' | 'subjectId' | 'startTime' | 'endTime' | 'durationHours' | 'hourlyPriceSnapshot' | 'notes'
    >,
  ): Booking => ({
    ...fields,
    totalPrice: fields.hourlyPriceSnapshot * fields.durationHours,
    attachments: [],
    lessonSummary: null,
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    cancelledBy: null,
    cancelledAt: null,
    refundPercentage: null,
    refundAmount: null,
    createdAt: stamp,
    updatedAt: stamp,
  })

  const bookings: Booking[] = [
    booking({
      id: 1,
      studentId: 3,
      tutorId: 1,
      subjectId: 1,
      startTime: at(now, 2, 14),
      endTime: at(now, 2, 15),
      durationHours: 1,
      hourlyPriceSnapshot: 400,
      notes: 'Loops and list comprehensions, please.',
    }),
    // Booked when Bob charged ฿300/hr for Calculus I; he now charges ฿350/hr (BR-09).
    booking({
      id: 2,
      studentId: 3,
      tutorId: 2,
      subjectId: 3,
      startTime: at(now, 4, 10),
      endTime: at(now, 4, 12),
      durationHours: 2,
      hourlyPriceSnapshot: 300,
      notes: 'Limits and derivatives before the midterm.',
    }),
  ]

  return {
    users,
    credentials: Object.fromEntries(users.map((u) => [u.id, SEED_PASSWORD])),
    subjects: [
      { id: 1, name: 'Python Basics', description: 'Variables, control flow, functions', createdAt: stamp },
      { id: 2, name: 'Data Structures', description: 'Lists, stacks, trees, graphs', createdAt: stamp },
      { id: 3, name: 'Calculus I', description: 'Limits, derivatives, integrals', createdAt: stamp },
      { id: 4, name: 'Linear Algebra', description: 'Vectors, matrices, eigenvalues', createdAt: stamp },
    ],
    tutorProfiles: [
      {
        id: 1,
        userId: 1,
        bio: 'Fourth-year CompEng. I teach Python by debugging real code with you, not by reading slides.',
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: 2,
        userId: 2,
        bio: 'Math TA for two years. Bring the problem set you are stuck on and we will work through it.',
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    tutorSubjects: [
      // Rates in baht, per subject.
      {
        id: 1,
        tutorProfileId: 1,
        subjectId: 1,
        hourlyPrice: 400,
        levels: ['HIGH_SCHOOL', 'UNDERGRADUATE'],
        topics: 'Variables, loops, functions and debugging your first programs.',
      },
      {
        id: 2,
        tutorProfileId: 1,
        subjectId: 2,
        hourlyPrice: 450,
        levels: ['UNDERGRADUATE'],
        topics: 'Linked lists, stacks, trees, hash tables and Big-O for exams.',
      },
      {
        id: 3,
        tutorProfileId: 2,
        subjectId: 3,
        hourlyPrice: 350,
        levels: ['HIGH_SCHOOL', 'UNDERGRADUATE'],
        topics: 'Limits, derivatives and integrals, with past-paper practice.',
      },
      {
        id: 4,
        tutorProfileId: 2,
        subjectId: 4,
        hourlyPrice: 380,
        levels: ['UNDERGRADUATE', 'GRADUATE'],
        topics: 'Matrices, vector spaces, eigenvalues and proofs.',
      },
    ],
    availabilities,
    bookings,
    nextIds: { user: 6, tutorProfile: 3, tutorSubject: 5, availability: 8, booking: 3 },
  }
}
