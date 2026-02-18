import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'sales.mobile.list-cache.v1';

interface CacheEnvelope<T> {
  value: T;
  updatedAt: number;
}

function toCacheKey(key: string): string {
  return `${CACHE_PREFIX}.${key}`;
}

async function readCache<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(toCacheKey(key));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    return parsed.value;
  } catch {
    await AsyncStorage.removeItem(toCacheKey(key));
    return null;
  }
}

async function writeCache<T>(key: string, value: T): Promise<void> {
  const payload: CacheEnvelope<T> = {
    value,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(toCacheKey(key), JSON.stringify(payload));
}

export async function cachedList<T>(key: string, fetcher: () => Promise<T[]>): Promise<T[]> {
  try {
    const fresh = await fetcher();
    await writeCache(key, fresh);
    return fresh;
  } catch (error) {
    const cached = await readCache<T[]>(key);
    if (cached) {
      return cached;
    }
    throw error;
  }
}
