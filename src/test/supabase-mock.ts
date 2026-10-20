/**
 * File purpose: In-memory stand-in for the Supabase client used by component tests, so no test can reach a real project.
 * Fallback/error behavior: Tables without fixtures read as empty; writes succeed and echo their payload unless a test installs a responder.
 * Known limitation: Only the query-builder methods the app uses are modelled; filters other than eq/is/in are recorded but not applied.
 */
import type { Session } from '@supabase/supabase-js';

export type QueryOperation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
export type QueryFilter = { kind: string; column: string; value: unknown };
export type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

/** One awaited Supabase request, as the code under test built it. */
export type QueryCall = {
  table: string;
  operation: QueryOperation;
  filters: QueryFilter[];
  payload: unknown;
  returning: boolean;
  cardinality: 'many' | 'single' | 'maybeSingle';
};

/** Returns a result for a request, or undefined to fall back to the table fixture. */
export type QueryResponder = (call: QueryCall) => QueryResult | undefined | Promise<QueryResult | undefined>;

/** Returns a result for an RPC call, or undefined to fall back to `{ data: null, error: null }`. */
export type RpcResponder = (args: unknown) => QueryResult | undefined | Promise<QueryResult | undefined>;

type AuthChangeCallback = (event: string, session: Session | null) => void;

/** Builds a minimal signed-in session for a fixture user. */
export function createSession(userId = 'user-1', email = 'pilot@example.test'): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: 4_102_444_800,
    token_type: 'bearer',
    user: {
      id: userId,
      email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z'
    }
  } as Session;
}

/** A promise whose settlement the test controls, for asserting loading states without timers. */
export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function matchesFilters(row: Record<string, unknown>, filters: QueryFilter[]) {
  return filters.every((filter) => {
    if (filter.kind === 'eq') return row[filter.column] === filter.value;
    if (filter.kind === 'is') return (row[filter.column] ?? null) === filter.value;
    if (filter.kind === 'in') return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
    return true;
  });
}

function createSupabaseMock() {
  let tables: Record<string, Record<string, unknown>[]> = {};
  let responders: QueryResponder[] = [];
  let calls: QueryCall[] = [];
  let rpcCalls: { name: string; args: unknown }[] = [];
  let rpcResponders: Record<string, RpcResponder> = {};
  let session: Session | null = null;
  let sessionLoader: (() => Promise<Session | null>) | null = null;
  let authListeners = new Set<AuthChangeCallback>();

  function tableResult(call: QueryCall): QueryResult {
    if (call.operation !== 'select' && !call.returning) return { data: null, error: null };
    const rows =
      call.operation === 'select'
        ? (tables[call.table] ?? []).filter((row) => matchesFilters(row, call.filters))
        : ([] as unknown[]).concat(call.payload ?? []);
    if (call.cardinality === 'many') return { data: rows, error: null };
    if (call.cardinality === 'maybeSingle') return { data: rows[0] ?? null, error: null };
    return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: `Expected one ${call.table} row, found ${rows.length}.` } };
  }

  async function execute(call: QueryCall): Promise<QueryResult> {
    calls.push(call);
    for (const responder of responders) {
      const result = await responder(call);
      if (result) return result;
    }
    return tableResult(call);
  }

  function createQuery(table: string) {
    const call: QueryCall = { table, operation: 'select', filters: [], payload: undefined, returning: false, cardinality: 'many' };
    const run = () => execute({ ...call, filters: [...call.filters] });

    const query = {
      select() {
        if (call.operation === 'select') return query;
        call.returning = true;
        return query;
      },
      insert(payload: unknown) {
        call.operation = 'insert';
        call.payload = payload;
        return query;
      },
      update(payload: unknown) {
        call.operation = 'update';
        call.payload = payload;
        return query;
      },
      upsert(payload: unknown) {
        call.operation = 'upsert';
        call.payload = payload;
        return query;
      },
      delete() {
        call.operation = 'delete';
        return query;
      },
      eq(column: string, value: unknown) {
        call.filters.push({ kind: 'eq', column, value });
        return query;
      },
      is(column: string, value: unknown) {
        call.filters.push({ kind: 'is', column, value });
        return query;
      },
      in(column: string, value: unknown) {
        call.filters.push({ kind: 'in', column, value });
        return query;
      },
      neq(column: string, value: unknown) {
        call.filters.push({ kind: 'neq', column, value });
        return query;
      },
      not(column: string, operator: string, value: unknown) {
        call.filters.push({ kind: `not.${operator}`, column, value });
        return query;
      },
      or(expression: string) {
        call.filters.push({ kind: 'or', column: expression, value: null });
        return query;
      },
      gte(column: string, value: unknown) {
        call.filters.push({ kind: 'gte', column, value });
        return query;
      },
      lte(column: string, value: unknown) {
        call.filters.push({ kind: 'lte', column, value });
        return query;
      },
      order() {
        return query;
      },
      limit() {
        return query;
      },
      range() {
        return query;
      },
      single() {
        call.cardinality = 'single';
        return run();
      },
      maybeSingle() {
        call.cardinality = 'maybeSingle';
        return run();
      },
      then<TResult1 = QueryResult, TResult2 = never>(
        onFulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
        onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) {
        return run().then(onFulfilled, onRejected);
      }
    };
    return query;
  }

  const auth = {
    async getSession() {
      const current = sessionLoader ? await sessionLoader() : session;
      return { data: { session: current }, error: null };
    },
    async getUser() {
      return session ? { data: { user: session.user }, error: null } : { data: { user: null }, error: null };
    },
    onAuthStateChange(callback: AuthChangeCallback) {
      authListeners.add(callback);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
    },
    async signOut() {
      session = null;
      authListeners.forEach((listener) => listener('SIGNED_OUT', null));
      return { error: null };
    }
  };

  const storage = {
    from(bucket: string) {
      return {
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${bucket}/${path}` } }),
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://storage.test/${bucket}/${path}?signed` }, error: null }),
        upload: async () => ({ data: null, error: null }),
        remove: async () => ({ data: null, error: null }),
        download: async () => ({ data: null, error: { message: 'Storage downloads are not available in tests.' } })
      };
    }
  };

  const client = {
    from: (table: string) => createQuery(table),
    rpc(name: string, args?: unknown) {
      rpcCalls.push({ name, args });
      const responder = rpcResponders[name];
      const result = Promise.resolve(responder?.(args)).then((response) => response ?? { data: null, error: null });
      return Object.assign(result, { single: () => result, maybeSingle: () => result });
    },
    auth,
    storage
  };

  return {
    client,
    /** Restores the empty, signed-out default. Called before every test by the shared setup. */
    reset() {
      tables = {};
      responders = [];
      calls = [];
      rpcCalls = [];
      rpcResponders = {};
      session = null;
      sessionLoader = null;
      authListeners = new Set();
    },
    setTable(table: string, rows: Record<string, unknown>[]) {
      tables[table] = rows;
    },
    respond(responder: QueryResponder) {
      responders.push(responder);
    },
    /** Installs the result for every call to the named RPC. */
    respondRpc(name: string, responder: RpcResponder) {
      rpcResponders[name] = responder;
    },
    setSession(next: Session | null) {
      session = next;
    },
    /** Makes getSession wait on the given loader, for testing auth initialization. */
    setSessionLoader(loader: () => Promise<Session | null>) {
      sessionLoader = loader;
    },
    emitAuthChange(event: string, next: Session | null) {
      session = next;
      authListeners.forEach((listener) => listener(event, next));
    },
    get calls() {
      return calls;
    },
    get rpcCalls() {
      return rpcCalls;
    },
    writes() {
      return calls.filter((call) => call.operation !== 'select');
    }
  };
}

export const supabaseMock = createSupabaseMock();
