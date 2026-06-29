import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

// Top-level safety net. Catches render/lifecycle errors anywhere below it and
// shows a recoverable fallback instead of a blank white screen. Uses inline
// styles so the fallback renders even if stylesheet loading was the failure.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          background: '#0b0c0e',
          color: '#e8e8e8',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Something went wrong.</h1>
        <p style={{ margin: 0, maxWidth: '32rem', opacity: 0.8 }}>
          The app hit an unexpected error. Your saved charts are still in browser storage —
          reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: '1px solid #d4a23c',
            background: 'transparent',
            color: '#d4a23c',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}
