'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Called when an error is caught — useful for logging to Sentry/DataDog */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary wrapper for feature sections.
 * Prevents a crash in one section from taking down the entire app.
 *
 * Usage:
 *   <FeatureErrorBoundary name="Optimizer">
 *     <OptimizerView />
 *   </FeatureErrorBoundary>
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-red-400">Error en esta sección</h3>
          <p className="mt-1 max-w-sm text-xs text-red-300/70">
            {this.state.error?.message || 'Ocurrió un error inesperado.'}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
