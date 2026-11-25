import { useEffect, useState } from 'react'
import { useMockApp } from '../../context/appContext'
import type { PendingTutor } from '../../types/types'
import { formatDay } from '../../utils/format'

export function AdminTutorsView() {
  const { mode, db, getPendingTutors, approveTutor } = useMockApp()
  const [apiPending, setApiPending] = useState<PendingTutor[] | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<number | null>(null)

  useEffect(() => {
    if (mode !== 'api') return
    let active = true
    getPendingTutors()
      .then((data) => {
        if (active) setApiPending(data)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load pending tutors.')
      })
    return () => {
      active = false
    }
  }, [mode, getPendingTutors])

  const mockPending: PendingTutor[] = db.users
    .filter((u) => u.role === 'TUTOR' && !u.isApproved)
    .map((u) => {
      const profile = db.tutorProfiles.find((p) => p.userId === u.id)
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isApproved: u.isApproved,
        createdAt: u.createdAt,
        bio: profile?.bio ?? null,
      }
    })

  const pending = mode === 'api' && apiPending !== null ? apiPending : mockPending
  const approved = db.users.filter((u) => u.role === 'TUTOR' && u.isApproved)

  const handleApprove = async (tutor: PendingTutor) => {
    setError(null)
    setApprovingId(tutor.id)
    try {
      await approveTutor(tutor.id)
      setSuccessNotice(`Approved ${tutor.name}`)
      if (mode === 'api') {
        const refreshed = await getPendingTutors()
        setApiPending(refreshed)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve tutor.')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <main className="th-page">
      <header className="th-page-header">
        <h1>
          <span className="th-accent-text">Tutors</span>
        </h1>
        <p>Review and approve tutor registrations and manage school instructors.</p>
      </header>

      {successNotice && (
        <div className="th-notice th-notice-success mb-4" role="status">
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="th-notice th-notice-danger mb-4" role="alert">
          <span>{error}</span>
        </div>
      )}

      <section className="mb-5" aria-labelledby="heading-pending">
        <h2 id="heading-pending" className="h4 mb-3">
          Pending approvals
        </h2>
        {pending.length === 0 ? (
          <div className="th-empty py-4">
            <p className="mb-0 text-muted-ink">No pending tutor approvals.</p>
          </div>
        ) : (
          <div className="table-responsive th-table-wrap">
            <table className="table th-table align-middle" aria-label="Pending tutors">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Bio / Qualifications</th>
                  <th scope="col" className="text-end">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pending.map((t) => (
                  <tr key={t.id}>
                    <td className="fw-semibold">{t.name}</td>
                    <td>{t.email}</td>
                    <td>{formatDay(t.createdAt)}</td>
                    <td className="text-muted-ink">{t.bio || 'No bio provided'}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-brand btn-sm"
                        disabled={approvingId === t.id}
                        aria-label={`Approve ${t.name}`}
                        onClick={() => handleApprove(t)}
                      >
                        {approvingId === t.id ? 'Approving…' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="heading-approved">
        <h2 id="heading-approved" className="h4 mb-3">
          Approved tutors
        </h2>
        {approved.length === 0 ? (
          <div className="th-empty py-4">
            <p className="mb-0 text-muted-ink">No approved tutors yet.</p>
          </div>
        ) : (
          <div className="table-responsive th-table-wrap">
            <table className="table th-table align-middle" aria-label="Approved tutors">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {approved.map((t) => (
                  <tr key={t.id}>
                    <td className="th-num text-start">#{t.id}</td>
                    <td className="fw-semibold">{t.name}</td>
                    <td>{t.email}</td>
                    <td>
                      <span className="th-tag th-tag-success">Approved</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
