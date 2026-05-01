interface MemoryCacheEntry<T> {
  value: T;
  updatedAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry<unknown>>();

export function readMemoryCache<T>(key: string): MemoryCacheEntry<T> | null {
  const entry = memoryCache.get(key);
  return entry ? (entry as MemoryCacheEntry<T>) : null;
}

export function writeMemoryCache<T>(key: string, value: T): void {
  memoryCache.set(key, {
    value,
    updatedAt: Date.now(),
  });
}

export function clearMemoryCache(key?: string): void {
  if (key) {
    memoryCache.delete(key);
    return;
  }
  memoryCache.clear();
}
