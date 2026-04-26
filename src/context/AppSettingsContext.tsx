import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import { getMyTenant, listCommerceSettings } from '../api/services';
import { formatCurrency } from '../utils/format';
import { useAuth } from './AuthContext';

interface AppSettingsValue {
  /** Nom de la boutique : Tenant.name (autorité), fallback CommerceSettings.nom puis "Ma boutique". */
  shopName: string;
  /** Devise ISO 4217 (XAF, EUR, USD...). Vient de CommerceSettings.devise, défaut XAF. */
  currency: string;
  /** Indique si le 1er chargement est en cours (pour éviter de flasher des défauts). */
  isLoading: boolean;
  /** Force un rechargement (à appeler après une modification dans Paramètres). */
  refresh: () => Promise<void>;
}

const DEFAULT_CURRENCY = 'XAF';
const DEFAULT_SHOP_NAME = 'Ma boutique';

const AppSettingsContext = createContext<AppSettingsValue | undefined>(undefined);

export function AppSettingsProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [shopName, setShopName] = useState<string>(DEFAULT_SHOP_NAME);
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!session) {
      setShopName(DEFAULT_SHOP_NAME);
      setCurrency(DEFAULT_CURRENCY);
      return;
    }

    setIsLoading(true);
    const [tenantResult, settingsResult] = await Promise.allSettled([
      getMyTenant(),
      listCommerceSettings(),
    ]);

    let resolvedShopName = DEFAULT_SHOP_NAME;
    if (tenantResult.status === 'fulfilled' && tenantResult.value?.name?.trim()) {
      resolvedShopName = tenantResult.value.name.trim();
    } else if (
      settingsResult.status === 'fulfilled'
      && settingsResult.value.length > 0
      && settingsResult.value[settingsResult.value.length - 1]?.nom?.trim()
    ) {
      resolvedShopName = settingsResult.value[settingsResult.value.length - 1].nom.trim();
    }

    let resolvedCurrency = DEFAULT_CURRENCY;
    if (settingsResult.status === 'fulfilled' && settingsResult.value.length > 0) {
      const latest = settingsResult.value[settingsResult.value.length - 1];
      if (latest?.devise?.trim()) {
        resolvedCurrency = latest.devise.trim().toUpperCase();
      }
    }

    setShopName(resolvedShopName);
    setCurrency(resolvedCurrency);
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<AppSettingsValue>(
    () => ({ shopName, currency, isLoading, refresh: load }),
    [shopName, currency, isLoading, load],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider');
  }
  return ctx;
}

/**
 * Hook utilitaire qui retourne une fonction `format(value)` utilisant la devise
 * actuellement configurée par le tenant. Préférer ce hook à `formatCurrency`
 * direct pour que les écrans réagissent automatiquement aux changements de devise.
 */
export function useFormatCurrency(): (value: number) => string {
  const { currency } = useAppSettings();
  return useCallback((value: number) => formatCurrency(value, currency), [currency]);
}
