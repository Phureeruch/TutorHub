import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
  /** Clears the saved mock data; the boundary then re-renders its children. */
  onReset(): void
}

interface AppErrorBoundaryState {
  error: Error | null
}

/**
 * Last line of defence for the mock store: if saved data ever crashes a render,
 * the user gets a reset button instead of a blank page they cannot recover from.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('TutorHub crashed while rendering', error, info.componentStack)
  }

  private handleReset = () => {
    this.props.onReset()
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="th-page">
        <div className="th-page-header">
          <h1>Something went wrong</h1>
          <p>
            The demo data saved in this browser could not be shown. Resetting it restores the seed accounts and lessons.
          </p>
        </div>
        <button type="button" className="btn btn-ink" onClick={this.handleReset}>
          Reset demo data
        </button>
      </main>
    )
  }
}
