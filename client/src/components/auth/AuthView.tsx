import { useRef, useState, type FormEvent } from 'react'
import { ApiError, MIN_PASSWORD_LENGTH } from '../../api/mockApi'
import { useMockApp } from '../../context/appContext'
import { useFieldError } from '../../hooks/useFieldError'
import { SEED_ACCOUNTS, SEED_PASSWORD } from '../../data/seedData'
import type { Role } from '../../types/types'
import { AppLink } from '../ui/AppLink'
import { ResetPasswordModal } from './ResetPasswordModal'

const ROLE_LABEL: Record<Role, string> = { STUDENT: 'Student', TUTOR: 'Tutor', ADMIN: 'Admin' }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Try again.')

function SignInForm() {
  const { login } = useMockApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const { error, setError, fail, invalidProps, clearField } = useFieldError({ email: emailRef, password: passwordRef })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setNotice(null)
    if (!email.trim()) return fail({ field: 'email', message: 'Enter your email.' })
    if (!password) return fail({ field: 'password', message: 'Enter your password.' })
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      // Deliberately not saying which of the two was wrong.
      fail({ field: null, message: messageOf(err) })
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            ref={emailRef}
            type="email"
            className="form-control"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearField('email')
            }}
            required
            {...invalidProps('email')}
          />
        </div>
        <div className="mb-2">
          <label className="form-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            ref={passwordRef}
            type="password"
            className="form-control"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearField('password')
            }}
            required
            {...invalidProps('password')}
          />
        </div>
        <button type="button" className="btn-link-ink small mb-3" onClick={() => setResetOpen(true)}>
          Forgot your password?
        </button>
        {error && (
          <div className="th-notice th-notice-error mb-3" role="alert">
            {error.message}
          </div>
        )}
        {notice && (
          <div className="th-notice th-notice-success mb-3" role="status">
            {notice}
          </div>
        )}
        <button type="submit" className="btn btn-ink w-100">
          Sign in
        </button>
      </form>

      {(!import.meta.env.PROD || import.meta.env.VITE_SHOW_DEV_HINTS === 'true') && (
        <section className="th-seed" aria-labelledby="seed-heading">
          <h2 id="seed-heading" className="h3">
            Seed accounts
          </h2>
          <p className="small text-muted-ink mb-2">
            Development only. Every account uses the password <code>{SEED_PASSWORD}</code>.
          </p>
          <ul className="th-seed-list">
            {SEED_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <div>
                  <strong>{account.name}</strong> <span className="th-tag">{ROLE_LABEL[account.role]}</span>
                  <div className="small text-muted-ink">{account.note}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-ink btn-sm"
                  onClick={() => {
                    setEmail(account.email)
                    setPassword(SEED_PASSWORD)
                    setError(null)
                  }}
                  aria-label={`Fill in ${account.name}'s credentials`}
                >
                  Fill in
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resetOpen && (
        <ResetPasswordModal
          initialEmail={email}
          onClose={() => setResetOpen(false)}
          onReset={(resetEmail) => {
            setResetOpen(false)
            setEmail(resetEmail)
            setPassword('')
            setError(null)
            setNotice('Password reset. Sign in with your new password.')
          }}
        />
      )}
    </>
  )
}

function RegisterForm() {
  const { registerStudent } = useMockApp()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const { error, setError, fail, invalidProps, clearField } = useFieldError({
    name: nameRef,
    email: emailRef,
    password: passwordRef,
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // Checked in form order so focus lands on the first problem.
    if (!name.trim()) return fail({ field: 'name', message: 'Enter your name.' })
    if (!EMAIL_PATTERN.test(email.trim())) return fail({ field: 'email', message: 'Enter a valid email address.' })
    if (password.length < MIN_PASSWORD_LENGTH) {
      return fail({ field: 'password', message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` })
    }
    setError(null)
    try {
      await registerStudent({ name, email, password })
    } catch (err) {
      const field = err instanceof ApiError && err.status === 409 ? 'email' : null
      fail({ field, message: messageOf(err) })
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-3">
        <label className="form-label" htmlFor="reg-name">
          Full name
        </label>
        <input
          id="reg-name"
          ref={nameRef}
          className="form-control"
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            clearField('name')
          }}
          required
          {...invalidProps('name')}
        />
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="reg-email">
          Email
        </label>
        <input
          id="reg-email"
          ref={emailRef}
          type="email"
          className="form-control"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            clearField('email')
          }}
          required
          {...invalidProps('email')}
        />
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="reg-password">
          Password
        </label>
        <input
          id="reg-password"
          ref={passwordRef}
          type="password"
          className="form-control"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            clearField('password')
          }}
          aria-describedby="reg-password-hint"
          required
          {...invalidProps('password')}
        />
        <div id="reg-password-hint" className="form-text">
          At least {MIN_PASSWORD_LENGTH} characters.
        </div>
      </div>
      {error && (
        <div className="th-notice th-notice-error mb-3" role="alert">
          {error.message}
        </div>
      )}
      <button type="submit" className="btn btn-ink w-100">
        Create student account
      </button>
      <p className="small text-muted-ink mt-3 mb-0">
        Sign-up is for students. Tutor and admin accounts are created by the school administrator.
      </p>
    </form>
  )
}

export function AuthView({ mode }: { mode: 'login' | 'register' }) {
  return (
    <main className="th-auth">
      <header className="th-auth-header">
        <h1 className="th-wordmark th-wordmark-lg mb-1">TutorHub</h1>
        <p className="text-muted-ink small mb-0">School tutoring portal (release 2)</p>
      </header>

      <section className="th-auth-card th-surface" aria-label={mode === 'login' ? 'Sign in' : 'Create a student account'}>
        <nav className="th-auth-tabs" aria-label="Account">
          <AppLink to="/login" className="th-auth-tab" aria-current={mode === 'login' ? 'page' : undefined}>
            Sign in
          </AppLink>
          <AppLink to="/register" className="th-auth-tab" aria-current={mode === 'register' ? 'page' : undefined}>
            Create account
          </AppLink>
        </nav>
        <div className="th-auth-body">{mode === 'login' ? <SignInForm /> : <RegisterForm />}</div>
      </section>
    </main>
  )
}

