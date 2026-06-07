import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'var(--color-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: "'Cormorant Garamond', serif",
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: 400,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>☽</div>
            <h1 style={{
              fontSize: 24,
              color: 'var(--color-text)',
              marginBottom: 12,
              fontWeight: 400,
            }}>Something went wrong</h1>
            <p style={{
              fontSize: 14,
              color: 'var(--color-text-dim)',
              marginBottom: 24,
              lineHeight: 1.5,
            }}>
              The stars are misaligned. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                background: 'var(--color-input-hover)',
                border: '1px solid rgba(245, 230, 200, 0.15)',
                borderRadius: 8,
                color: 'var(--color-text)',
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
