import { useState } from 'react'
import { useCurrentUser, useMockApp } from '../../context/appContext'

/** BR-02 / FR-04: students must complete the mock email check before booking. */
export function EmailVerificationBanner() {
  const user = useCurrentUser()
  const { verifyEmail } = useMockApp()
  const [justVerified, setJustVerified] = useState(false)

  if (user.role !== 'STUDENT') return null

  if (user.isEmailVerified) {
    if (!justVerified) return null
    return (
      <div className="th-banner th-banner-success" role="status">
        <div className="th-banner-inner">
          <span>Email verified. You can book lessons now.</span>
          <button type="button" className="btn-link-ink" onClick={() => setJustVerified(false)}>
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  const handleVerify = async () => {
    await verifyEmail()
    setJustVerified(true)
  }

  return (
    <div className="th-banner" role="region" aria-label="Email verification">
      <div className="th-banner-inner">
        <span>
          Verify <strong>{user.email}</strong> before you book. This is a mock check, so no email is sent.
        </span>
        <button type="button" className="btn btn-ink btn-sm" onClick={handleVerify}>
          Verify email now
        </button>
      </div>
    </div>
  )
}
