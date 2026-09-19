import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Magazoo!:', error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '2rem',
            maxWidth: '600px',
            margin: '4rem auto',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            color: '#111418',
          }}
        >
          <h2 style={{ marginTop: 0, color: '#dc2626' }}>Something went wrong</h2>
          <p style={{ color: '#4b5563', lineHeight: 1.5 }}>
            An unexpected error occurred while rendering the editor or preview.
          </p>
          {this.state.error && (
            <pre
              style={{
                background: '#f3f4f6',
                padding: '1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                overflowX: 'auto',
                color: '#1f2937',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: '1rem',
              padding: '0.6rem 1.2rem',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
