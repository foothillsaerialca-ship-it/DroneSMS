type CacheEntry<T> = { expiresAt: number; promise: Promise<T> };
const requests = new Map<string, CacheEntry<unknown>>();

export function cachedRequest<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = 30_000,
): Promise<T> {
  const existing = requests.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) return existing.promise;
  const promise = loader().catch((error) => {
    requests.delete(key);
    throw error;
  });
  requests.set(key, { expiresAt: Date.now() + ttlMs, promise });
  return promise;
}

export function invalidateCachedRequests(prefix: string) {
  for (const key of requests.keys())
    if (key.startsWith(prefix)) requests.delete(key);
}
