import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: 'Terjadi kesalahan. Silakan muat ulang halaman.',
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Terjadi kesalahan. Silakan coba lagi nanti.';
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[HW][ErrorBoundary]', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {this.state.message}
          </div>
        )
      );
    }

    return this.props.children;
  }
}
