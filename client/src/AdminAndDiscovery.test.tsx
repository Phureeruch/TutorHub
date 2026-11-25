// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createSeedDb } from './data/seedData'
import { renderAppAt, SEED } from './test/renderApp'

afterEach(cleanup)

describe('Admin Tutor Approvals (F-13, AC-13.1, AC-13.2, STS-13.5)', () => {
  it('renders pending tutor approval queue and approves a pending tutor', async () => {
    const user = userEvent.setup()
    const db = createSeedDb(new Date())

    // Add a pending tutor to the mock DB
    db.users.push({
      id: 99,
      name: 'Evan Pending',
      email: 'evan.pending@tutorhub.dev',
      role: 'TUTOR',
      isEmailVerified: true,
      isApproved: false,
    })

    renderAppAt('/admin/tutors', SEED.ADMIN, db)

    // Heading exists
    expect(await screen.findByRole('heading', { level: 1, name: /Tutors/i })).toBeTruthy()

    // Evan Pending appears in the pending table/card with an Approve button
    expect(screen.getByText('Evan Pending')).toBeTruthy()
    const approveBtn = screen.getByRole('button', { name: /Approve Evan Pending/i })
    expect(approveBtn).toBeTruthy()

    await user.click(approveBtn)

    // Verify success banner appears and Evan is approved
    expect(await screen.findByText(/Approved Evan Pending/i)).toBeTruthy()
  })
})

describe('Admin Subject Catalog (F-13, AC-13.4, AC-13.5, STS-13.5)', () => {
  it('renders subject catalog table and adds a new subject', async () => {
    const user = userEvent.setup()
    const db = createSeedDb(new Date())

    renderAppAt('/admin/subjects', SEED.ADMIN, db)

    expect(await screen.findByRole('heading', { level: 1, name: /Subject catalog/i })).toBeTruthy()

    // Existing seed subjects are rendered
    expect(screen.getByText('Python Basics')).toBeTruthy()
    expect(screen.getByText('Calculus I')).toBeTruthy()

    // Click "Add subject" button
    await user.click(screen.getByRole('button', { name: /Add subject/i }))

    // Fill form in modal
    const nameInput = await screen.findByLabelText(/Subject name/i)
    const descInput = screen.getByLabelText(/Description/i)

    await user.type(nameInput, 'Discrete Math')
    await user.type(descInput, 'Logic, sets, functions, and graph theory.')

    await user.click(screen.getByRole('button', { name: /Create subject/i }))

    // New subject appears in the table
    expect(await screen.findByText('Discrete Math')).toBeTruthy()
  })
})

describe('Discovery Time Window Filter (F-09, AC-09.1, AC-09.5, STS-09.5)', () => {
  it('renders time filter selects and allows filtering by time window', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)

    expect(await screen.findByRole('heading', { level: 1, name: /Find a tutor/i })).toBeTruthy()

    // Time filter dropdowns exist
    const fromTimeSelect = screen.getByLabelText(/From time/i)
    const toTimeSelect = screen.getByLabelText(/To time/i)
    expect(fromTimeSelect).toBeTruthy()
    expect(toTimeSelect).toBeTruthy()

    // Select time window
    await user.selectOptions(fromTimeSelect, '09:00')
    await user.selectOptions(toTimeSelect, '12:00')

    // Clear filters button resets selects
    const clearBtn = screen.getByRole('button', { name: /Clear filters/i })
    await user.click(clearBtn)

    expect((fromTimeSelect as HTMLSelectElement).value).toBe('')
    expect((toTimeSelect as HTMLSelectElement).value).toBe('')
  })
})
