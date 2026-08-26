/**
 * File purpose: Provides the client application module.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../../lib/env';

let initializedSupabase: SupabaseClient | null = null;

/**
 * Implements make unavailable client for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
function makeUnavailableClient(message: string): any {
	/**
	 * Implements fn for this module.
	 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
	 */
	const fn = async () => ({ data: null, error: new Error(message) });

	const authProxy = new Proxy(
		{},
		{
			/**
			 * Computes get for the surrounding workflow.
			 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
			 */
			get(_t, method: string | symbol) {
				if (method === 'getSession') {
					return async () => ({ data: { session: null }, error: null });
				}
				if (method === 'onAuthStateChange') {
					return (_callback: any) => ({ data: { subscription: { unsubscribe: () => {} } }, error: null });
				}
				if (method === 'signInWithPassword' || method === 'getUser') {
					return async (..._args: any[]) => ({ data: null, error: new Error(message) });
				}
				return async (..._args: any[]) => ({ data: null, error: new Error(message) });
			}
		}
	);

	const handler: ProxyHandler<any> = {
		/**
		 * Computes get for the surrounding workflow.
		 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
		 */
		get(_target, prop) {
			if (prop === 'auth') return authProxy;
			if (prop === 'from')
				return () =>
					new Proxy(
						{},
						{
							/**
							 * Computes get for the surrounding workflow.
							 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
							 */
							get() {
								return async (..._args: any[]) => ({ data: null, error: new Error(message) });
							}
						}
					);
			return fn;
		}
	};

	return new Proxy({}, handler);
}

/**
 * Computes create supabase client for the surrounding workflow.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
function createSupabaseClient() {
	const env = getEnv();
	const hasUrl = typeof env.supabaseUrl === 'string' && env.supabaseUrl.trim().length > 0;
	const hasKey = typeof env.supabaseAnonKey === 'string' && env.supabaseAnonKey.trim().length > 0;
	if (!hasUrl || !hasKey) {
		const message = 'Supabase is not configured: missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY.';
		return makeUnavailableClient(message) as SupabaseClient;
	}
	return createClient(env.supabaseUrl, env.supabaseAnonKey);
}

/**
 * Computes get supabase client for the surrounding workflow.
 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
 */
function getSupabaseClient() {
	if (!initializedSupabase) {
		initializedSupabase = createSupabaseClient();
	}
	return initializedSupabase;
}

/**
 * Purpose: Stores the shared supabase structure used by the client module.
 * Fallback/error behavior: Empty or missing collections use the owning workflow default; external persisted values are normalized by the consuming function where supported.
 * Known limitation: Persisted values outside this structure may require legacy normalization before they can be selected or displayed.
 */
export const supabase = new Proxy({} as SupabaseClient, {
	/**
	 * Computes get for the surrounding workflow.
	 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
	 */
	get(_target, property) {
		const client = getSupabaseClient();
		const value = (client as any)[property];
		return typeof value === 'function' ? value.bind(client) : value;
	},
	/**
	 * Performs set for the surrounding workflow.
	 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
	 */
	set(_target, property, value) {
		const client = getSupabaseClient();
		(client as any)[property] = value;
		return true;
	},
	/**
	 * Determines has for the surrounding workflow.
	 * Fallback/error behavior: Missing optional input uses the defaults defined in the function; unexpected input or runtime failures propagate unless explicitly normalized.
	 */
	has(_target, property) {
		const client = getSupabaseClient();
		return property in client;
	}
});
