/**
 * File purpose: Provides supabase domain utilities and service adapters shared by the application.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
export { supabase } from '@backend/integrations/supabase/client';
export { isSupabaseConfigured } from '@backend/lib/env';
