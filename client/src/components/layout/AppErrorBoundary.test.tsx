// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

afterEach(cleanup)

describe('AppErrorBoundary', () => {
  it('replaces a crashed tree with a way to reset the demo data', async () => {
    const user = userEvent.setup()
    let broken = true
    function Fragile() {
      if (broken) throw new Error('bad saved state')
      return <p>App is back</p>
    }
    const onReset = vi.fn(() => {
      broken = false
    })
    vi.spyOn(console, 'error').mockImplementation(() => {}) // React logs caught render errors

    render(
      <AppErrorBoundary onReset={onReset}>
        <Fragile />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }))

    expect(onReset).toHaveBeenCalledOnce()
    expect(screen.getByText('App is back')).toBeTruthy()
  })
})
