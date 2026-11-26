// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from './context/persistence'
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
    await user.type(await screen.findByLabelText('Email'), 'alice@tutorhub.dev')
    await user.type(screen.getByLabelText('Password'), 'password123')
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
    await user.click(within(dialog).getByRole('button', { name: /^09:30–10:30/ }))
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

    const rate = (await screen.findByLabelText(/Rate for Python Basics/)) as HTMLInputElement
    await user.clear(rate)
    await user.type(rate, '650')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Profile saved.')).toBeTruthy()
    expect((screen.getByLabelText(/Rate for Python Basics/) as HTMLInputElement).value).toBe('650')
  })

  it('shows a rate field for each subject the tutor teaches, and adds one when a subject is ticked', async () => {
    const user = userEvent.setup()
    renderAppAt('/tutor/profile', SEED.ALICE)

    expect(((await screen.findByLabelText(/Rate for Python Basics/)) as HTMLInputElement).value).toBe('400')
    expect((screen.getByLabelText(/Rate for Data Structures/) as HTMLInputElement).value).toBe('450')
    expect(screen.queryByLabelText(/Rate for Linear Algebra/)).toBeNull()

    await user.click(screen.getByRole('checkbox', { name: 'Linear Algebra' }))
    expect(screen.getByLabelText(/Rate for Linear Algebra/)).toBeTruthy()
  })
})

describe('subject levels and topics (team review)', () => {
  it('lets a tutor set levels and topics per subject, and students see them', async () => {
    const user = userEvent.setup()
    renderAppAt('/tutor/profile', SEED.ALICE)

    const levels = await screen.findByRole('group', { name: 'Levels for Data Structures' })
    await user.click(within(levels).getByRole('checkbox', { name: 'Graduate' }))
    const topics = screen.getByLabelText(/Topics for Data Structures/) as HTMLTextAreaElement
    await user.clear(topics)
    await user.type(topics, 'Graph algorithms and dynamic programming')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Profile saved.')).toBeTruthy()

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).db
    cleanup()
    renderAppAt('/student/discover', SEED.CHARLIE, saved)
    const alice = await screen.findByRole('article', { name: 'Alice' })
    expect(within(alice).getByText('Graph algorithms and dynamic programming')).toBeTruthy()
    expect(within(alice).getAllByText('Graduate').length).toBe(1)
  })

  it('filters tutors by level', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)

    await user.selectOptions(await screen.findByLabelText('Level'), 'Graduate')
    expect(screen.queryByRole('article', { name: 'Alice' })).toBeNull()
    expect(screen.getByRole('article', { name: 'Bob' })).toBeTruthy()
  })
})

describe('account menu', () => {
  it('opens from the profile icon, shows who is signed in, and signs out', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)

    const account = await screen.findByRole('button', { name: /^Account/ })
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    await user.click(account)
    expect(account.getAttribute('aria-expanded')).toBe('true')
    // Clicking text inside the panel (e.g. to copy the email) must not close it.
    await user.click(screen.getByText(/charlie@/))
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(document.activeElement).toBe(account)

    await user.click(account)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy()
  })
})

describe('booking modal slot picker, subject pricing and files', () => {
  it('picks a start hour on the ruler, stretches the lesson by tapping a later hour, and applies the 5% bundle discount (STS-L7-07)', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)
    const [aliceTomorrow] = await screen.findAllByRole('button', { name: /^Book Alice on/ })
    await user.click(aliceTomorrow) // 09:30–12:30, Python Basics ฿400/hr
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: /^10:30–11:30/ }))
    await user.click(within(dialog).getByRole('button', { name: /^11:30–12:30/ }))

    expect(within(dialog).getByRole('button', { name: /^10:30–11:30/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(dialog).getByRole('button', { name: /^11:30–12:30/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(dialog).getByRole('button', { name: /^09:30–10:30/ }).getAttribute('aria-pressed')).toBe('false')
    expect(within(dialog).getByText(/Multi-hour discount \(5% off\)/)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Pay ฿760 and confirm' })).toBeTruthy()
  })

  it('lets the student tap each hour, totals them with 5% and 10% bundle discounts, and refuses gaps or splits (STS-L7-07)', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)
    const [aliceTomorrow] = await screen.findAllByRole('button', { name: /^Book Alice on/ })
    await user.click(aliceTomorrow) // 09:30–12:30 at ฿400/hr
    const dialog = screen.getByRole('dialog')
    const hour = (name: RegExp) => within(dialog).getByRole('button', { name })
    const pay = (total: string) => within(dialog).getByRole('button', { name: `Pay ${total} and confirm` })

    await user.click(hour(/^09:30–10:30/))
    await user.click(hour(/^11:30–12:30/))
    expect(within(dialog).getByText(/next to the ones you chose/)).toBeTruthy()
    expect(hour(/^11:30–12:30/).getAttribute('aria-pressed')).toBe('false')
    expect(pay('฿400')).toBeTruthy()

    await user.click(hour(/^10:30–11:30/))
    await user.click(hour(/^11:30–12:30/))
    expect(within(dialog).getByText(/Multi-hour discount \(10% off\)/)).toBeTruthy()
    expect(pay('฿1,080')).toBeTruthy()
    expect(within(dialog).queryByText(/next to the ones you chose/)).toBeNull()

    await user.click(hour(/^10:30–11:30/))
    expect(within(dialog).getByText(/would split the lesson/)).toBeTruthy()
    expect(pay('฿1,080')).toBeTruthy()

    await user.click(hour(/^09:30–10:30/))
    expect(within(dialog).getByText('10:30–12:30')).toBeTruthy()
    expect(pay('฿760')).toBeTruthy()
  })

  it('shows what the tutor covers in the chosen subject', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)
    const [aliceTomorrow] = await screen.findAllByRole('button', { name: /^Book Alice on/ })
    await user.click(aliceTomorrow)
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByText(/Variables, loops, functions/)).toBeTruthy()
    await user.selectOptions(within(dialog).getByLabelText('Subject'), 'Data Structures (฿450/hr)')
    expect(within(dialog).getByText(/Linked lists, stacks, trees/)).toBeTruthy()
  })

  it('opens with no hours chosen and asks the student to pick some', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)
    const [aliceTomorrow] = await screen.findAllByRole('button', { name: /^Book Alice on/ })
    await user.click(aliceTomorrow)
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).queryAllByRole('button', { pressed: true })).toHaveLength(0)
    const pay = within(dialog).getByRole('button', { name: 'Pick hours to continue' }) as HTMLButtonElement
    expect(pay.disabled).toBe(true)
  })

  it('lets the student skip a rejected file and still pay', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)
    const [aliceTomorrow] = await screen.findAllByRole('button', { name: /^Book Alice on/ })
    await user.click(aliceTomorrow)
    const dialog = screen.getByRole('dialog')

    const huge = new File(['x'], 'scan.pdf', { type: 'application/pdf' })
    Object.defineProperty(huge, 'size', { value: 21 * 1024 * 1024 })
    await user.upload(within(dialog).getByLabelText(/Lecture files/), huge)
    expect(within(dialog).getByRole('alert').textContent).toMatch(/scan\.pdf is larger than 20 MB/)

    await user.click(within(dialog).getByRole('button', { name: /^09:30–10:30/ }))
    const pay = within(dialog).getByRole('button', { name: 'Pay ฿400 and confirm' }) as HTMLButtonElement
    expect(pay.disabled).toBe(false)
  })

  it('removes only the chosen file when two share a name', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)
    const [aliceTomorrow] = await screen.findAllByRole('button', { name: /^Book Alice on/ })
    await user.click(aliceTomorrow)
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByLabelText(/Lecture files/)

    await user.upload(input, new File(['a'], 'notes.pdf', { type: 'application/pdf' }))
    await user.upload(input, new File(['bb'], 'notes.pdf', { type: 'application/pdf' }))
    const removes = within(dialog).getAllByRole('button', { name: /^Remove notes\.pdf/ })
    expect(removes).toHaveLength(2)

    await user.click(removes[0])
    expect(within(dialog).getAllByRole('button', { name: /^Remove notes\.pdf/ })).toHaveLength(1)
  })

  it("prices the lesson at the chosen subject's rate", async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)
    const [aliceTomorrow] = await screen.findAllByRole('button', { name: /^Book Alice on/ })
    await user.click(aliceTomorrow)
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: /^09:30–10:30/ }))
    await user.selectOptions(within(dialog).getByLabelText('Subject'), 'Data Structures (฿450/hr)')
    expect(within(dialog).getByRole('button', { name: 'Pay ฿450 and confirm' })).toBeTruthy()
  })

  it('attaches an optional lecture file and shows it in the booking details', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/discover', SEED.CHARLIE)
    const [aliceTomorrow] = await screen.findAllByRole('button', { name: /^Book Alice on/ })
    await user.click(aliceTomorrow)
    const dialog = screen.getByRole('dialog')

    const file = new File(['%PDF-1.4'], 'week5-recursion.pdf', { type: 'application/pdf' })
    await user.upload(within(dialog).getByLabelText(/Lecture files/), file)
    expect(within(dialog).getByText('week5-recursion.pdf')).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: /^09:30–10:30/ }))
    await user.click(within(dialog).getByRole('button', { name: /^Pay .* and confirm$/ }))
    expect(await screen.findByText(/^Booked:/, {}, { timeout: 3000 })).toBeTruthy()

    await user.click(screen.getByRole('link', { name: 'See my bookings' }))
    const viewButtons = await screen.findAllByRole('button', { name: /View booking #/ })
    await user.click(viewButtons[0]) // tomorrow's lesson sorts first
    expect(within(screen.getByRole('dialog')).getByText(/week5-recursion\.pdf/)).toBeTruthy()
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
    await user.click(within(dialog).getByRole('button', { name: /^13:30–14:30/ }))
    await user.click(within(dialog).getByRole('button', { name: /^14:30–15:30/ }))

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
    const rate = await screen.findByLabelText(/Rate for Python Basics/)
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
  it('renders a centered login card without the marketing intro or seed accounts section, while keeping demo controls', async () => {
    renderAppAt('/login', null)
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy()
    expect(screen.queryByText(/Book an hour with a tutor from your school/i)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Seed accounts' })).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Demo controls' })).toBeTruthy()
  })

  it('toggles password visibility with the eye icon button on login and registration forms', async () => {
    const user = userEvent.setup()
    renderAppAt('/login', null)
    const passwordInput = (await screen.findByLabelText('Password')) as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(passwordInput.type).toBe('text')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(passwordInput.type).toBe('password')
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

  it('marks the full name input aria-invalid and focuses it when registering with a blank name (FR-02, #46)', async () => {
    const user = userEvent.setup()
    renderAppAt('/register', null)
    const fullName = await screen.findByLabelText('Full name')
    await user.type(fullName, '   ')
    await user.type(screen.getByLabelText('Email'), 'blank-name@tutorhub.dev')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create student account' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Enter your name.')
    expect(fullName.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(fullName)
  })
})

describe('booking cancellation, 3-tier refund preview, tutor cancellation & availability edit UI (F-10, F-11, F-12, STS-10.7, STS-11.4)', () => {
  it('shows 50% refund preview when student cancels a booking 24–72h out and restores merged availability', async () => {
    const user = userEvent.setup()
    renderAppAt('/student/bookings', SEED.CHARLIE)

    const cancelButtons = await screen.findAllByRole('button', { name: /^Cancel booking #/ })
    await user.click(cancelButtons[0])

    const dialog = screen.getByRole('dialog', { name: /Cancel booking #1/i })
    expect(within(dialog).getByText(/50%/i)).toBeTruthy()
    expect(within(dialog).getByText(/฿200/)).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Confirm cancellation' }))

    expect(await screen.findByText('Cancelled')).toBeTruthy()
    expect(screen.getByText(/Partly refunded/)).toBeTruthy()
  })

  it('warns tutor that student receives 100% refund and slot remains blocked on tutor cancellation', async () => {
    const user = userEvent.setup()
    renderAppAt('/tutor/appointments', SEED.ALICE)

    const cancelBtn = await screen.findByRole('button', { name: 'Cancel appointment #1' })
    await user.click(cancelBtn)

    const dialog = screen.getByRole('dialog', { name: /Cancel appointment #1/i })
    expect(within(dialog).getByText(/100% refund/i)).toBeTruthy()
    expect(within(dialog).getByText(/remain blocked/i)).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Confirm cancellation' }))

    expect(await screen.findByText('Cancelled')).toBeTruthy()
    expect(screen.getByText('Refunded')).toBeTruthy()
  })

  it('lets a tutor edit an existing open availability window', async () => {
    const user = userEvent.setup()
    renderAppAt('/tutor/dashboard', SEED.ALICE)

    const editButtons = await screen.findAllByRole('button', { name: /^Edit / })
    await user.click(editButtons[0])

    const dialog = screen.getByRole('dialog', { name: /Edit open window/i })
    const lengthSelect = within(dialog).getByLabelText('Length')
    await user.selectOptions(lengthSelect, '2')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/Updated window/i)).toBeTruthy()
  })
})
