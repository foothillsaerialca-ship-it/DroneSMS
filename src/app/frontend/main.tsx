/**
 * File purpose: Bootstraps React, global styles, authentication state, and the application router.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from '../router';
import './styles/globals.css';
import { AuthProvider } from './features/auth/components/auth-provider';
import { AppErrorBoundary } from './components/app-error-boundary';
import { reportClientError } from './lib/telemetry';

window.addEventListener('unhandledrejection', (event) => reportClientError('unhandled_promise_rejection', event.reason));
window.addEventListener('error', (event) => reportClientError('unhandled_window_error', event.error));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
