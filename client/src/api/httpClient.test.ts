// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY, getStoredToken, httpClient, setStoredToken } from './httpClient'
import { ApiError } from './mockApi'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('httpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    setStoredToken(null)
  })

  it('stores token on login and attaches Bearer header on authenticated calls', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          token: 'jwt-abc',
          user: { id: 3, email: 'charlie@tutorhub.dev', name: 'Charlie', role: 'STUDENT' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse([]))

    await httpClient.login('charlie@tutorhub.dev', 'password123')
    expect(getStoredToken()).toBe('jwt-abc')
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('jwt-abc')

    await httpClient.listBookings()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, secondInit] = fetchMock.mock.calls[1]
    const headers = new Headers(secondInit?.headers)
    expect(headers.get('Authorization')).toBe('Bearer jwt-abc')

    httpClient.logout()
    expect(getStoredToken()).toBeNull()
  })

  it('stores token on student registration so verification works immediately', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          message: 'Registration successful.',
          userId: 6,
          token: 'reg-jwt',
          user: {
            id: 6,
            email: 'eve@tutorhub.dev',
            name: 'Eve',
            role: 'STUDENT',
            isEmailVerified: false,
            isApproved: false,
            createdAt: '2026-11-12T00:00:00.000Z',
            updatedAt: '2026-11-12T00:00:00.000Z',
          },
        },
        201,
      ),
    )

    const res = await httpClient.registerStudent({
      name: 'Eve',
      email: 'eve@tutorhub.dev',
      password: 'password123',
    })
    expect(res.user.id).toBe(6)
    expect(getStoredToken()).toBe('reg-jwt')
  })

  it('maps non-2xx JSON { message } responses into ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ message: 'This time is no longer available. Your payment was not taken.' }, 409),
    )

    let caught: unknown
    try {
      await httpClient.createBooking({
        tutorId: 1,
        subjectId: 1,
        startTime: '2026-11-14T02:30:00.000Z',
        durationHours: 1,
      })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(409)
    expect((caught as ApiError).message).toBe('This time is no longer available. Your payment was not taken.')
  })

  it('uploads File instances as multipart/form-data to /api/attachments', async () => {
    setStoredToken('student-jwt')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ id: 12, name: 'slides.pdf', size: 8, type: 'application/pdf' }, 201),
    )

    const file = new File(['%PDF-1.4'], 'slides.pdf', { type: 'application/pdf' })
    const uploaded = await httpClient.uploadAttachment(file)

    expect(uploaded).toEqual({ id: 12, name: 'slides.pdf', size: 8, type: 'application/pdf' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/attachments')
    expect(init?.body).toBeInstanceOf(FormData)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer student-jwt')
  })

  it('passes discovery query filters to GET /api/availability', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([]))

    await httpClient.listTutorDirectory({
      subjectId: 2,
      tutorId: 1,
      date: '2026-11-14',
      level: 'UNDERGRADUATE',
    })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/availability?subjectId=2&tutorId=1&date=2026-11-14&level=UNDERGRADUATE')
  })
})
