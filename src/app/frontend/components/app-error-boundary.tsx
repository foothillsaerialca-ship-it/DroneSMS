import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { reportClientError } from '@frontend/lib/telemetry';

type State = { error: Error | null; correlationId: string | null };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null, correlationId: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, correlationId: crypto.randomUUID() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError('application_render_failed', error, {
      correlationId: this.state.correlationId,
      component: info.componentStack?.split('\n').find(Boolean)?.trim() ?? null
    });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center p-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm" role="alert">
          <h1 className="text-xl font-semibold text-brand-900">DroneSMS needs to recover</h1>
          <p className="mt-2 text-sm text-slate-700">An unexpected display error occurred. Your saved records were not removed.</p>
          <p className="mt-2 text-xs text-slate-500">Reference: {this.state.correlationId}</p>
          <button className="mt-4 min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()}>
            Reload DroneSMS
          </button>
        </section>
      </main>
    );
  }
}
