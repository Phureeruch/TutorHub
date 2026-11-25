// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createSeedDb } from './data/seedData'
import { renderAppAt, SEED } from './test/renderApp'

afterEach(cleanup)

describe('Tutor Lesson Completion & Homework Notes (F-16, AC-16.1, AC-16.2, STS-16.6)', () => {
  it('allows assigned tutor to complete a confirmed lesson and record summary notes', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const db = createSeedDb(now)

    // Ensure Alice has at least one confirmed booking
    const booking = db.bookings.find((b) => b.tutorId === SEED.ALICE && b.status === 'CONFIRMED')
    expect(booking).toBeDefined()
    if (!booking) return

    renderAppAt('/tutor/appointments', SEED.ALICE, db)

    // Verify Appointments header rendered
    expect(await screen.findByRole('heading', { level: 1, name: /Appointments/i })).toBeTruthy()

    // Find "Complete lesson" button for this booking (fails in RED phase)
    const completeBtn = screen.getByRole('button', { name: new RegExp(`Complete lesson #${booking.id}`, 'i') })
    expect(completeBtn).toBeTruthy()

    await user.click(completeBtn)

    // Modal opens with lesson notes textarea
    const notesInput = await screen.findByLabelText(/Lesson summary & homework notes/i)
    expect(notesInput).toBeTruthy()

    // Submit valid notes
    await user.type(notesInput, 'Reviewed binary search trees. Homework: Problems 4.1 to 4.5.')
    const submitBtn = screen.getByRole('button', { name: /^Complete lesson$/i })
    await user.click(submitBtn)

    // Verify completed badge and notes are displayed
    expect(await screen.findByText(/Lesson notes & homework/i)).toBeTruthy()
    expect(screen.getByText(/Reviewed binary search trees/i)).toBeTruthy()
  })
})
