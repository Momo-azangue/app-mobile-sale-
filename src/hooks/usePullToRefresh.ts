import { useCallback, useState } from 'react';

export function usePullToRefresh(refresher: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresher();
    } finally {
      setRefreshing(false);
    }
  }, [refresher]);

  return { refreshing, onRefresh };
}
