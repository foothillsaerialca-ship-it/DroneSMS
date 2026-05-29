import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../../lib/env';

let initializedSupabase: SupabaseClient | null = null;

function makeUnavailableClient(message: string): any {
	const fn = async () => ({ data: null, error: new Error(message) });

	const authProxy = new Proxy(
		{},
		{
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
		get(_target, prop) {
			if (prop === 'auth') return authProxy;
			if (prop === 'from')
				return () =>
					new Proxy(
						{},
						{
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

function getSupabaseClient() {
	if (!initializedSupabase) {
		initializedSupabase = createSupabaseClient();
	}
	return initializedSupabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
	get(_target, property) {
		const client = getSupabaseClient();
		const value = (client as any)[property];
		return typeof value === 'function' ? value.bind(client) : value;
	},
	set(_target, property, value) {
		const client = getSupabaseClient();
		(client as any)[property] = value;
		return true;
	},
	has(_target, property) {
		const client = getSupabaseClient();
		return property in client;
	}
});
