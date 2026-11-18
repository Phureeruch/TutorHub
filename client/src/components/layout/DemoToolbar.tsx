import { useState } from 'react'
import { useMockApp } from '../../context/appContext'
import { SEED_ACCOUNTS, SEED_PASSWORD } from '../../data/seedData'

/** Dev/demo aid: jump between seed users, force a 409, or reset/refresh data (F-08). */
export function DemoToolbar() {
  const { mode, db, currentUser, login, switchDemoUser, simulateConflict, setSimulateConflict, resetToSeedData } =
    useMockApp()
  const [expanded, setExpanded] = useState(false)

  const handleReset = () => {
    if (mode === 'api') {
      resetToSeedData()
      return
    }
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
            {SEED_ACCOUNTS.map((account) => {
              const matched = db.users.find((u) => u.email === account.email)
              if (mode === 'mock' && !matched) return null
              const isActive = currentUser?.email === account.email
              return (
                <button
                  key={account.email}
                  type="button"
                  className="th-demo-chip"
                  aria-pressed={isActive}
                  onClick={() => {
                    if (mode === 'api') {
                      void login(account.email, SEED_PASSWORD)
                    } else if (matched) {
                      switchDemoUser(matched.id)
                    }
                  }}
                >
                  {account.name}
                </button>
              )
            })}
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
            {mode === 'api' ? 'Refresh data' : 'Reset demo data'}
          </button>
        </div>
      )}
    </aside>
  )
}
