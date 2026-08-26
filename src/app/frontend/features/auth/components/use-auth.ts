/**
 * File purpose: Provides the reusable use auth React component and its local interaction behavior.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { useContext } from 'react';
import { AuthContext } from './auth-provider';

/**
 * Implements use auth for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
