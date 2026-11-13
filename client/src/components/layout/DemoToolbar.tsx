import { useState } from 'react'
import { useMockApp } from '../../context/appContext'
import { SEED_ACCOUNTS } from '../../data/seedData'

/** Sprint 1 demo aid: jump between seed users, force a 409, or reset data (F-08). */
export function DemoToolbar() {
  const { db, currentUser, switchDemoUser, simulateConflict, setSimulateConflict, resetToSeedData } = useMockApp()
  const [expanded, setExpanded] = useState(false)

  const seedUsers = SEED_ACCOUNTS.map((a) => db.users.find((u) => u.email === a.email)).filter((u) => u !== undefined)

  const handleReset = () => {
    if (window.confirm('Reset all demo data to the seed state? Bookings and changes made in this browser will be lost.')) {
      resetToSeedData()
    }
  }

  return (
    <aside className="th-demo" aria-label="Demo controls">
      <div className="th-demo-inner">
        <button
          type="button"
          className="th-demo-toggle"
          aria-expanded={expanded}
          aria-controls="th-demo-panel"
          onClick={() => setExpanded((v) => !v)}
        >
          Demo controls {expanded ? '(hide)' : ''}
        </button>
        {simulateConflict && !expanded && <span className="th-demo-flag">409 simulation on</span>}
      </div>
      {expanded && (
        <div id="th-demo-panel" className="th-demo-inner th-demo-panel">
          <div className="th-demo-group" role="group" aria-label="Sign in as">
            <span className="th-demo-label">Sign in as</span>
            {seedUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                className="th-demo-chip"
                aria-pressed={currentUser?.id === u.id}
                onClick={() => switchDemoUser(u.id)}
              >
                {u.name}
              </button>
            ))}
          </div>
          <label className="th-demo-check">
            <input
              type="checkbox"
              checked={simulateConflict}
              onChange={(e) => setSimulateConflict(e.target.checked)}
            />
            Simulate a concurrent booking conflict (409)
          </label>
          <button type="button" className="th-demo-chip" onClick={handleReset}>
            Reset demo data
          </button>
        </div>
      )}
    </aside>
  )
}
