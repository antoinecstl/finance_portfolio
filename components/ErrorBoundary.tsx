'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type Props = {
  children: ReactNode;
  label?: string;
  // Fallback UI custom optionnel. Sinon, on affiche une carte d'erreur standard.
  fallback?: (err: Error, reset: () => void) => ReactNode;
};

type State = { error: Error | null };

// Error boundary React classique : cible chaque section du Dashboard pour qu'une
// erreur isolée (ex: Yahoo timeout sur un chart) n'abatte pas tout l'écran.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // On log côté console mais on pourrait brancher Sentry ici.
    console.error('[ErrorBoundary]', this.props.label ?? 'unknown', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full p-2 bg-red-100 dark:bg-red-900/30 text-red-600 flex-shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-red-800 dark:text-red-200">
              Cette section n&apos;a pas pu se charger
              {this.props.label ? ` — ${this.props.label}` : ''}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-red-700 dark:text-red-300 break-words">
              {error.message || 'Erreur inattendue'}
            </p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }
}
