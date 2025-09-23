import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

const defaultMessage = 'Terjadi kesalahan. Silakan coba lagi nanti.';

function DefaultFallback({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-3xl border border-border-subtle bg-surface px-6 py-10 text-center shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-text">Ups, ada yang salah</h2>
        <p className="text-sm text-muted" aria-live="polite">
          {message || defaultMessage}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        Muat ulang
      </button>
    </div>
  );
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: defaultMessage,
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error && error.message
        ? error.message
        : defaultMessage;
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[HW][ErrorBoundary]', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <DefaultFallback message={this.state.message} />;
    }

    return this.props.children;
  }
}
