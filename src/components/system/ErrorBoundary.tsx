import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[HW][ErrorBoundary]', error, info);
    }
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface-alt px-6 py-12 text-center text-text">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-semibold">Terjadi kesalahan</h1>
            <p className="text-sm text-muted">
              Ups, ada sesuatu yang tidak berjalan semestinya. Silakan muat ulang
              halaman ini dan coba lagi.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="btn btn-primary w-full sm:w-auto"
            >
              Muat ulang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
