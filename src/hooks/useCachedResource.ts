import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '../api/errors';
import { readMemoryCache, writeMemoryCache } from '../api/memoryCache';

type LoadMode = 'auto' | 'blocking' | 'silent';

interface UseCachedResourceOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  refreshSignal?: number;
  enabled?: boolean;
}

interface UseCachedResourceResult<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshError: string | null;
  reload: (mode?: LoadMode) => Promise<void>;
  setCachedData: (next: T) => void;
}

export function useCachedResource<T>({
  key,
  fetcher,
  refreshSignal,
  enabled = true,
}: UseCachedResourceOptions<T>): UseCachedResourceResult<T> {
  const initialCache = readMemoryCache<T>(key);
  const dataRef = useRef<T | null>(initialCache?.value ?? null);
  const keyRef = useRef(key);
  const requestIdRef = useRef(0);

  const [data, setData] = useState<T | null>(() => initialCache?.value ?? null);
  const [loading, setLoading] = useState(() => enabled && initialCache === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const setCachedData = useCallback((next: T) => {
    writeMemoryCache(key, next);
    dataRef.current = next;
    setData(next);
    setError(null);
    setRefreshError(null);
    setLoading(false);
  }, [key]);

  const reload = useCallback(async (mode: LoadMode = 'auto') => {
    if (!enabled) {
      return;
    }

    const hasData = dataRef.current !== null;
    const shouldBlock = mode === 'blocking' || (mode === 'auto' && !hasData);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (shouldBlock) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    setRefreshError(null);

    try {
      const next = await fetcher();
      if (requestIdRef.current !== requestId) {
        return;
      }
      writeMemoryCache(key, next);
      dataRef.current = next;
      setData(next);
    } catch (loadError) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      const message = getErrorMessage(loadError);
      if (dataRef.current === null) {
        setError(message);
      } else {
        setRefreshError(message);
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [enabled, fetcher, key]);

  useEffect(() => {
    if (keyRef.current === key) {
      return;
    }

    keyRef.current = key;
    requestIdRef.current += 1;
    const cached = readMemoryCache<T>(key);
    dataRef.current = cached?.value ?? null;
    setData(cached?.value ?? null);
    setError(null);
    setRefreshError(null);
    setRefreshing(false);
    setLoading(enabled && cached === null);
  }, [enabled, key]);

  useEffect(() => {
    const cached = readMemoryCache<T>(key);
    if (cached && dataRef.current === null) {
      dataRef.current = cached.value;
      setData(cached.value);
      setLoading(false);
    }
    void reload('auto');
  }, [key, reload, refreshSignal]);

  return {
    data,
    loading,
    refreshing,
    error,
    refreshError,
    reload,
    setCachedData,
  };
}
