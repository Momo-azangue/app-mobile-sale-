import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { listClients, listInvoices } from '../api/services';
import { getErrorMessage } from '../api/errors';
import { formatCurrency } from '../utils/format';
import type { InvoiceResponseDTO } from '../types/api';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { KPICard } from '../components/common/KPICard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface DashboardScreenProps {
  refreshSignal: number;
}

interface DayAggregate {
  day: string;
  value: number;
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function normalizeDate(isoDate?: string): Date | null {
  if (!isoDate) {
    return null;
  }
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildSalesTrend(invoices: InvoiceResponseDTO[]): DayAggregate[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const buckets = new Map<string, number>();

  for (let index = 0; index < 7; index += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    buckets.set(current.toDateString(), 0);
  }

  for (const invoice of invoices) {
    const matchingDate = normalizeDate(invoice.saleDate ?? invoice.date);
    if (!matchingDate) {
      continue;
    }

    const key = matchingDate.toDateString();
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + invoice.montant);
    }
  }

  return Array.from(buckets.entries()).map(([key, value]) => {
    const date = new Date(key);
    return {
      day: DAYS[date.getDay()],
      value,
    };
  });
}

export function DashboardScreen({ refreshSignal }: DashboardScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceResponseDTO[]>([]);
  const [clientsCount, setClientsCount] = useState(0);

  const loadDashboard = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const [fetchedInvoices, fetchedClients] = await Promise.all([listInvoices(), listClients()]);
      setInvoices(fetchedInvoices);
      setClientsCount(fetchedClients.length);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(true);
  }, [loadDashboard, refreshSignal]);
  const { refreshing, onRefresh } = usePullToRefresh(() => loadDashboard(false));

  const kpis = useMemo(() => {
    const today = new Date();

    const isToday = (isoDate?: string) => {
      const date = normalizeDate(isoDate);
      if (!date) {
        return false;
      }

      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    };

    const revenueToday = invoices
      .filter((invoice) => isToday(invoice.saleDate ?? invoice.date))
      .reduce((sum, invoice) => sum + invoice.montant, 0);

    const invoicesOpen = invoices.filter((invoice) => invoice.statut !== 'PAYE');
    const openAmount = invoicesOpen.reduce((sum, invoice) => sum + invoice.balanceDue, 0);

    return {
      revenueToday,
      openCount: invoicesOpen.length,
      openAmount,
      salesToday: invoices.filter((invoice) => isToday(invoice.saleDate ?? invoice.date)).length,
      clientsCount,
      partialCount: invoices.filter((invoice) => invoice.statut === 'PARTIEL').length,
      unpaidCount: invoices.filter((invoice) => invoice.statut === 'IMPAYE').length,
    };
  }, [clientsCount, invoices]);

  const trend = useMemo(() => buildSalesTrend(invoices), [invoices]);
  const maxTrend = Math.max(1, ...trend.map((entry) => entry.value));

  if (loading) {
    return <LoadingState message='Chargement du dashboard...' />;
  }

  if (error) {
    return <ErrorState title='Erreur dashboard' message={error} onRetry={() => void loadDashboard()} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
      }
    >
      <ScreenHeader title='Dashboard' subtitle='Vue business en temps reel' />

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCell}>
          <KPICard title='CA du jour' value={formatCurrency(kpis.revenueToday)} icon='dollar-sign' />
        </View>
        <View style={styles.kpiCell}>
          <KPICard title='Factures ouvertes' value={kpis.openCount} icon='file-text' trend={{ value: formatCurrency(kpis.openAmount), positive: false }} />
        </View>
        <View style={styles.kpiCell}>
          <KPICard title='Ventes du jour' value={kpis.salesToday} icon='shopping-cart' />
        </View>
        <View style={styles.kpiCell}>
          <KPICard title='Clients actifs' value={kpis.clientsCount} icon='users' />
        </View>
      </View>

      <View style={styles.cardFull}>
        <Text style={styles.cardTitle}>Evolution ventes (7 jours)</Text>
        <View style={styles.chartContainer}>
          {trend.map((entry) => {
            const columnHeight = (entry.value / maxTrend) * 100;
            return (
              <View key={entry.day} style={styles.chartColumn}>
                <View style={[styles.chartBar, { height: `${columnHeight}%` }]} />
                <Text style={styles.chartLabel}>{entry.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.cardFull}>
        <Text style={styles.cardTitle}>A faire</Text>

        <View style={styles.todoItem}>
          <View style={styles.todoIcon}>
            <Feather name='alert-triangle' size={16} color={colors.warning600} />
          </View>
          <Text style={styles.todoText}>{kpis.unpaidCount} factures impayees</Text>
        </View>

        <View style={styles.todoItem}>
          <View style={styles.todoIcon}>
            <Feather name='clock' size={16} color={colors.primary600} />
          </View>
          <Text style={styles.todoText}>{kpis.partialCount} factures partielles</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    paddingBottom: 96,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  kpiCell: {
    width: '47%',
  },
  cardFull: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 16,
    marginTop: 16,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.label,
    color: colors.neutral600,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 160,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  chartColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  chartBar: {
    width: 18,
    borderRadius: 12,
    backgroundColor: colors.primary600,
    marginBottom: 8,
  },
  chartLabel: {
    ...typography.caption,
    color: colors.neutral500,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral100,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  todoIcon: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 8,
    marginRight: 12,
  },
  todoText: {
    flex: 1,
    ...typography.label,
    color: colors.neutral800,
  },
});
