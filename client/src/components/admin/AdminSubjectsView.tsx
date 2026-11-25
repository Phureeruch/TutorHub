import { useState, type FormEvent } from 'react'
import { useMockApp } from '../../context/appContext'
import type { Subject } from '../../types/types'
import { Modal } from '../ui/Modal'

export function AdminSubjectsView() {
  const { db, createSubject, updateSubject } = useMockApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleOpenAdd = () => {
    setEditingSubject(null)
    setName('')
    setDescription('')
    setError(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (subject: Subject) => {
    setEditingSubject(subject)
    setName(subject.name)
    setDescription(subject.description ?? '')
    setError(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError('Subject name must be between 2 and 80 characters.')
      return
    }

    const trimmedDesc = description.trim()
    if (trimmedDesc.length > 300) {
      setError('Description cannot exceed 300 characters.')
      return
    }

    setSubmitting(true)
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, {
          name: trimmedName,
          description: trimmedDesc || null,
        })
        setSuccessNotice(`Updated subject "${trimmedName}"`)
      } else {
        await createSubject({
          name: trimmedName,
          description: trimmedDesc || null,
        })
        setSuccessNotice(`Created subject "${trimmedName}"`)
      }
      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving the subject.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="th-page">
      <header className="th-page-header d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h1>
            <span className="th-accent-text">Subject</span> catalog
          </h1>
          <p className="mb-0">Manage the curriculum subjects offered for tutoring across the platform.</p>
        </div>
        <button type="button" className="btn btn-brand" onClick={handleOpenAdd}>
          Add subject
        </button>
      </header>

      {successNotice && (
        <div className="th-notice th-notice-success mb-4" role="status">
          <span>{successNotice}</span>
        </div>
      )}

      {db.subjects.length === 0 ? (
        <div className="th-empty py-4">
          <p className="mb-0 text-muted-ink">No subjects in the catalog yet.</p>
        </div>
      ) : (
        <div className="table-responsive th-table-wrap">
          <table className="table th-table align-middle" aria-label="Subject catalog">
            <thead>
              <tr>
                <th scope="col" className="th-num text-start">
                  ID
                </th>
                <th scope="col">Subject name</th>
                <th scope="col">Description</th>
                <th scope="col" className="text-end">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {db.subjects.map((s) => (
                <tr key={s.id}>
                  <td className="th-num text-start">#{s.id}</td>
                  <td className="fw-semibold">{s.name}</td>
                  <td className="text-muted-ink">{s.description || '—'}</td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-outline-ink btn-sm"
                      onClick={() => handleOpenEdit(s)}
                      aria-label={`Edit ${s.name}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal
          title={editingSubject ? 'Edit subject' : 'Add subject'}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="th-notice th-notice-danger mb-3" role="alert">
                <span>{error}</span>
              </div>
            )}
            <div className="mb-3">
              <label htmlFor="subject-name" className="form-label">
                Subject name
              </label>
              <input
                id="subject-name"
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Discrete Math"
                required
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label htmlFor="subject-desc" className="form-label">
                Description
              </label>
              <textarea
                id="subject-desc"
                className="form-control"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of the curriculum (max 300 characters)"
              />
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-ink"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-brand" disabled={submitting}>
                {editingSubject ? (submitting ? 'Saving…' : 'Save changes') : submitting ? 'Creating…' : 'Create subject'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  )
}
