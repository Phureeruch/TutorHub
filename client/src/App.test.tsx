// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderAppAt, SEED } from './test/renderApp'
import { toDateInputValue } from './utils/format'

afterEach(cleanup)

describe('route guard (FR-03, BR-03)', () => {
  it('sends a signed-out visitor on a protected page to sign in', async () => {
    renderAppAt('/student/bookings', null)
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it("redirects a student away from the admin page and fixes the address bar", async () => {
    renderAppAt('/admin/bookings', SEED.CHARLIE)
    expect(await screen.findByRole('heading', { level: 1, name: 'Find a tutor' })).toBeTruthy()
    await waitFor(() => expect(window.location.pathname).toBe('/student/discover'))
  })

  it('sends a newly signed-in tutor to their dashboard', async () => {
    const user = userEvent.setup()
    renderAppAt('/login', null)
    await user.click(screen.getByRole('button', { name: "Fill in Alice's credentials" }))
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Availability' })).toBeTruthy()
    expect(window.location.pathname).toBe('/tutor/dashboard')
  })
})

describe('booking modal email gate (BR-02)', () => {
  it('blocks payment until the student verifies, then allows it', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.DIANA)

    const [firstBook] = await screen.findAllByRole('button', { name: /^Book Alice on/ })
    await user.click(firstBook)
    const dialog = screen.getByRole('dialog')
    const pay = within(dialog).getByRole('button', { name: /^Pay .* and confirm$/ }) as HTMLButtonElement

    expect(pay.disabled).toBe(true)
    expect(within(dialog).getByRole('alert').textContent).toMatch(/verify your email/i)

    await user.click(within(dialog).getByRole('button', { name: 'Verify email now' }))
    await waitFor(() => expect(pay.disabled).toBe(false))
  })
})

describe('tutor profile form', () => {
  it('keeps the "saved" confirmation and the new rate after saving', async () => {
    const user = userEvent.setup()
    renderAppAt('/tutor/profile', SEED.ALICE)

    const rate = (await screen.findByLabelText('Hourly rate (USD)')) as HTMLInputElement
    await user.clear(rate)
    await user.type(rate, '65')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Profile saved.')).toBeTruthy()
    expect((screen.getByLabelText('Hourly rate (USD)') as HTMLInputElement).value).toBe('65')
  })
})

describe('booking detail modal (FR-11, GET /api/bookings/:id)', () => {
  it('opens booking details from student bookings list', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/bookings', SEED.CHARLIE)

    const viewButtons = await screen.findAllByRole('button', { name: /View booking #/i })
    await user.click(viewButtons[0])
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Booking #1/i)).toBeTruthy()
    expect(within(dialog).getByText(/Loops and list comprehensions/i)).toBeTruthy()
  })

  it('offers details on tutor appointments and the admin table too', async () => {
    const user = userEvent.setup()
    renderAppAt('/admin/bookings', SEED.ADMIN)
    const adminButtons = await screen.findAllByRole('button', { name: /View booking #/i })
    expect(adminButtons).toHaveLength(2)
    await user.click(adminButtons[1])
    expect(within(screen.getByRole('dialog')).getByText(/Booking #2/i)).toBeTruthy()

    cleanup()
    renderAppAt('/tutor/appointments', SEED.ALICE)
    expect(await screen.findAllByRole('button', { name: /View booking #/i })).toHaveLength(1)
  })
})

describe('booking modal overlap preview (BR-07)', () => {
  it('warns the student inline when selected duration overlaps another confirmed booking (BR-07)', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)

    const bobButtons = await screen.findAllByRole('button', { name: /^Book Bob on/ })
    await user.click(bobButtons[1]) // Bob's Day+2 13:30–16:30 window
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Length'), '2 hours')

    expect(await within(dialog).findByText(/overlaps a lesson you already booked/i)).toBeTruthy()
    const pay = within(dialog).getByRole('button', { name: /^Pay .* and confirm$/ }) as HTMLButtonElement
    expect(pay.disabled).toBe(true)
  })
})

describe('student discovery filters (FR-07, SDS §4.2)', () => {
  it('filters open windows by tutor and date and resets filters', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)

    const tutorSelect = await screen.findByLabelText('Tutor')
    await user.selectOptions(tutorSelect, 'Bob')
    expect(screen.queryByRole('heading', { level: 2, name: 'Alice' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Bob' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Alice' })).toBeTruthy()
  })
})

describe('tutor availability removal confirmation', () => {
  it('asks for confirmation before removing an availability window', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAppAt('/tutor/dashboard', SEED.ALICE)

    const removeButtons = await screen.findAllByRole('button', { name: /^Remove / })
    const initialCount = removeButtons.length
    await user.click(removeButtons[0])

    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(screen.getAllByRole('button', { name: /^Remove / }).length).toBe(initialCount)
    confirmSpy.mockRestore()
  })

  it('removes the window once confirmed', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAppAt('/tutor/dashboard', SEED.ALICE)

    const removeButtons = await screen.findAllByRole('button', { name: /^Remove / })
    await user.click(removeButtons[0])

    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(removeButtons.length - 1))
    confirmSpy.mockRestore()
  })
})

describe('review fixes: headings, filters and field states', () => {
  it.each(['/login', '/register'])('gives %s a level-1 heading', async (path) => {
    renderAppAt(path, null)
    expect(await screen.findByRole('heading', { level: 1, name: 'TutorHub' })).toBeTruthy()
  })

  it('flags and focuses a blank sign-in email, then a blank password', async () => {
    const user = userEvent.setup()
    renderAppAt('/login', null)
    const email = await screen.findByLabelText('Email')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(email)

    await user.type(email, 'charlie@tutorhub.dev')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    const password = screen.getByLabelText('Password')
    expect(password.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(password)
  })

  it('shows an empty state for a date with no open windows and resets in one click', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)
    const dateInput = await screen.findByLabelText('Date')
    const today = new Date()
    const d3 = toDateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3))

    fireEvent.change(dateInput, { target: { value: d3 } })
    expect(await screen.findByText(/No open times on .* match these filters/)).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: 'Alice' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Show all open times' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Alice' })).toBeTruthy()
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('')
  })

  it('flags and focuses an invalid hourly rate on the tutor profile', async () => {
    const user = userEvent.setup()
    renderAppAt('/tutor/profile', SEED.ALICE)
    const rate = await screen.findByLabelText('Hourly rate (USD)')
    await user.clear(rate)
    await user.type(rate, '0')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(rate.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(rate)
  })

  it('flags and focuses a missing date in the availability form', async () => {
    const user = userEvent.setup()
    renderAppAt('/tutor/dashboard', SEED.ALICE)
    const date = await screen.findByLabelText('Date')
    fireEvent.change(date, { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Add window' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(date.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(date)
  })
})

describe('auth view layout and validation (F-01, UI/UX)', () => {
  it('renders a centered login card without the marketing intro section', async () => {
    renderAppAt('/login', null)
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy()
    expect(screen.queryByText(/Book an hour with a tutor from your school/i)).toBeNull()
  })

  it('marks the password input aria-invalid and focuses it when registering with a short password', async () => {
    const user = userEvent.setup()
    renderAppAt('/register', null)
    await user.type(await screen.findByLabelText('Full name'), 'Nong Film')
    await user.type(screen.getByLabelText('Email'), 'film@tutorhub.dev')
    const pwd = screen.getByLabelText('Password')
    await user.type(pwd, 'short')
    await user.click(screen.getByRole('button', { name: 'Create student account' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(pwd.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(pwd)
  })
})
