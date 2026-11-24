import { useState, type FormEvent } from 'react'
import { ApiError, MIN_PASSWORD_LENGTH } from '../../api/mockApi'
import { useMockApp } from '../../context/appContext'
import { Modal } from '../ui/Modal'
import { PasswordInput } from '../ui/PasswordInput'

interface ResetPasswordModalProps {
  initialEmail: string
  onClose(): void
  onReset(email: string): void
}

/** FR-04 mock reset: no email round-trip, the new password applies immediately. */
export function ResetPasswordModal({ initialEmail, onClose, onReset }: ResetPasswordModalProps) {
  const { resetPassword } = useMockApp()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await resetPassword(email, password)
      onReset(email)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password.')
    }
  }

  return (
    <Modal
      title="Reset your password"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-ink" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="reset-form" className="btn btn-ink">
            Reset password
          </button>
        </>
      }
    >
      <form id="reset-form" onSubmit={handleSubmit} noValidate>
        <p className="text-muted-ink">
          In Sprint 1 the reset link is simulated: set a new password here and sign in with it.
        </p>
        <div className="mb-3">
          <label className="form-label" htmlFor="reset-email">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            className="form-control"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-2">
          <label className="form-label" htmlFor="reset-password">
            New password
          </label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="reset-password-hint"
            required
          />
          <div id="reset-password-hint" className="form-text">
            At least {MIN_PASSWORD_LENGTH} characters.
          </div>
        </div>
        {error && (
          <div className="th-notice th-notice-error mt-3" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}
