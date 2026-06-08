import React from 'react'
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Log to console — could be extended to reporting services
    console.error('Unhandled error in React tree:', error, info)
    this.setState({ info })
  }

  render() {
    const { error, info } = this.state
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg-main)' }}>
          <div className="max-w-lg w-full rounded-2xl p-6" style={{ background: 'var(--color-card-main)', border: '1px solid var(--color-border-main)' }}>
            <h2 style={{ color: 'var(--color-text-main)' }} className="text-lg font-bold">Something went wrong</h2>
            <p style={{ color: 'var(--color-text-muted)' }} className="mt-2">The application encountered an unexpected error. You can reload the page or contact support.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl" style={{ background: 'linear-gradient(135deg,#cc0000,#aa0000)', color: 'white' }}>Reload</button>
              <button onClick={() => console.error(error, info)} className="px-4 py-2 rounded-xl" style={{ background: 'var(--color-card-hover)', border: '1px solid var(--color-border-main)' }}>Report</button>
            </div>
            <details className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <summary>Technical details</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{String(error)}\n{info?.componentStack}</pre>
            </details>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
