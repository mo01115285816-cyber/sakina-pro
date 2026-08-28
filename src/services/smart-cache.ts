export type SmartCacheEntry<T> = {
  data: T;
  savedAt: number;
};

const CACHE_VERSION = 1;
const memoryCache = new Map<string, SmartCacheEntry<unknown>>();

type StoredEntry<T> = SmartCacheEntry<T> & { version: number };

function readStorage<T>(key: string): SmartCacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredEntry<T>>;
    if (parsed.version !== CACHE_VERSION || typeof parsed.savedAt !== "number" || !("data" in parsed)) {
      sessionStorage.removeItem(key);
      return null;
    }
    return { data: parsed.data as T, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function getSmartCache<T>(key: string): SmartCacheEntry<T> | null {
  const inMemory = memoryCache.get(key) as SmartCacheEntry<T> | undefined;
  if (inMemory) return inMemory;

  const stored = readStorage<T>(key);
  if (stored) memoryCache.set(key, stored);
  return stored;
}

export function setSmartCache<T>(key: string, data: T): SmartCacheEntry<T> {
  const entry: SmartCacheEntry<T> = { data, savedAt: Date.now() };
  memoryCache.set(key, entry);
  try {
    const stored: StoredEntry<T> = { ...entry, version: CACHE_VERSION };
    sessionStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // Memory cache still keeps the current session fast if storage is unavailable or full.
  }
  return entry;
}

export function isSmartCacheStale(entry: SmartCacheEntry<unknown> | null, maxAgeMs: number): boolean {
  return !entry || Date.now() - entry.savedAt >= maxAgeMs;
}

export function invalidateSmartCache(key: string) {
  memoryCache.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage access failures.
  }
}
