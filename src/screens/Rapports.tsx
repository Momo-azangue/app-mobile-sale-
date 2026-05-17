import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { getSalesSummary, listSalesPage } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { useFormatCurrency } from '../context/AppSettingsContext';
import type { SaleResponseDTO, SalesSummaryResponseDTO } from '../types/api';
import { colors, radius, shadows, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { AppCard } from '../components/common/AppCard';
import { ErrorState } from '../components/common/ErrorState';
import { KPICard } from '../components/common/KPICard';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SegmentedControl, type SegmentedOption } from '../components/common/SegmentedControl';
import { SkeletonList } from '../components/common/SkeletonList';
import { useCachedResource } from '../hooks/useCachedResource';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { SalesHistogram, type SalesHistogramBucket } from './reports/SalesHistogram';

interface RapportsScreenProps {
  refreshSignal: number;
}

type ReportPeriod = '7d' | '30d';

interface ReportsData {
  summary: SalesSummaryResponseDTO;
  sales: SaleResponseDTO[];
}

interface OperatorPerformance {
  operatorKey: string;
  operatorName: string;
  total: number;
  count: number;
  items: number;
}

const PERIOD_OPTIONS: SegmentedOption[] = [
  { label: '7 jours', value: '7d' },
  { label: '30 jours', value: '30d' },
];

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

function periodToRange(period: ReportPeriod): { days: number; from: string; to: string } {
  const days = period === '7d' ? 7 : 30;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return { days, from: start.toISOString(), to: now.toISOString() };
}

async function listSalesForRange(from: string, to: string): Promise<SaleResponseDTO[]> {
  const accumulator: SaleResponseDTO[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await listSalesPage({ page, size: PAGE_SIZE, from, to });
    accumulator.push(...result.content);
    if (result.content.length < PAGE_SIZE || accumulator.length >= result.totalElements) {
      break;
    }
  }

  return accumulator;
}

function saleDate(sale: SaleResponseDTO): Date {
  return new Date(sale.date ?? sale.createdAt ?? sale.updatedAt ?? Date.now());
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shortDateLabel(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildHistogramBuckets(period: ReportPeriod, sales: SaleResponseDTO[]): SalesHistogramBucket[] {
  const { days } = periodToRange(period);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const buckets = new Map<string, SalesHistogramBucket>();
  for (let index = 0; index < days; index += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const key = dateKey(current);
    buckets.set(key, {
      key,
      label: shortDateLabel(current),
      total: 0,
      count: 0,
    });
  }

  sales.forEach((sale) => {
    const key = dateKey(saleDate(sale));
    const bucket = buckets.get(key);
    if (!bucket) {
      return;
    }
    bucket.total += sale.montantTotal ?? 0;
    bucket.count += 1;
  });

  return [...buckets.values()];
}

function buildOperatorPerformance(sales: SaleResponseDTO[]): OperatorPerformance[] {
  const groups = new Map<string, OperatorPerformance>();

  sales.forEach((sale) => {
    const operatorKey = sale.operatorId || sale.operatorName || 'unknown';
    const current = groups.get(operatorKey) ?? {
      operatorKey,
      operatorName: sale.operatorName || sale.operatorId || 'Utilisateur',
      total: 0,
      count: 0,
      items: 0,
    };

    current.total += sale.montantTotal ?? 0;
    current.count += 1;
    current.items += sale.products.reduce((sum, item) => sum + item.quantity, 0);
    groups.set(operatorKey, current);
  });

  return [...groups.values()].sort((left, right) => right.total - left.total);
}

function findMyPerformance(
  performances: OperatorPerformance[],
  email?: string,
): OperatorPerformance | null {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.toLowerCase();
  return performances.find((entry) => entry.operatorKey.toLowerCase() === normalizedEmail) ?? null;
}

export function RapportsScreen({ refreshSignal }: RapportsScreenProps) {
  const { session } = useAuth();
  const formatCurrency = useFormatCurrency();
  const [period, setPeriod] = useState<ReportPeriod>('7d');

  const range = useMemo(() => periodToRange(period), [period]);

  const fetchReports = useCallback(async (): Promise<ReportsData> => {
    const [summary, sales] = await Promise.all([
      getSalesSummary(period),
      listSalesForRange(range.from, range.to),
    ]);
    return { summary, sales };
  }, [period, range.from, range.to]);

  const { data, loading, error, reload } = useCachedResource({
    key: `screen.rapports:${period}`,
    fetcher: fetchReports,
    refreshSignal,
  });
  const { refreshing, onRefresh } = usePullToRefresh(() => reload('silent'));

  const histogram = useMemo(
    () => buildHistogramBuckets(period, data?.sales ?? []),
    [data?.sales, period],
  );
  const performances = useMemo(
    () => buildOperatorPerformance(data?.sales ?? []),
    [data?.sales],
  );
  const myPerformance = useMemo(
    () => findMyPerformance(performances, session?.email),
    [performances, session?.email],
  );

  if (loading) {
    return <SkeletonList count={5} />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title='Erreur rapports'
        message={error ?? 'Donnees indisponibles'}
        onRetry={() => void reload('blocking')}
      />
    );
  }

  const averageBasket = data.summary.count > 0 ? data.summary.total / data.summary.count : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
      }
    >
      <ScreenHeader title='Rapports' subtitle='Historique des ventes et performances' />

      <SegmentedControl
        options={PERIOD_OPTIONS}
        value={period}
        onChange={(value) => setPeriod(value as ReportPeriod)}
      />

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCell}>
          <KPICard title='Chiffre affaires' value={formatCurrency(data.summary.total)} icon='dollar-sign' />
        </View>
        <View style={styles.kpiCell}>
          <KPICard title='Ventes' value={data.summary.count} icon='shopping-cart' />
        </View>
        <View style={styles.kpiCell}>
          <KPICard title='Panier moyen' value={formatCurrency(averageBasket)} icon='bar-chart-2' />
        </View>
        <View style={styles.kpiCell}>
          <KPICard
            title='A encaisser'
            value={formatCurrency(data.summary.unpaidTotal)}
            icon='alert-circle'
            trend={data.summary.unpaidTotal > 0 ? { value: 'Factures ouvertes', positive: false } : undefined}
          />
        </View>
      </View>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Ventes par jour</Text>
            <Text style={styles.sectionSubtitle}>Histogramme du chiffre affaires sur la periode</Text>
          </View>
          <Feather name='bar-chart-2' size={20} color={colors.primary600} />
        </View>
        <SalesHistogram buckets={histogram} formatCurrency={formatCurrency} />
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Mes performances</Text>
            <Text style={styles.sectionSubtitle}>Basees sur l'utilisateur connecte</Text>
          </View>
          <Feather name='user-check' size={20} color={colors.primary600} />
        </View>

        {myPerformance ? (
          <View style={styles.performanceRow}>
            <View>
              <Text style={styles.performanceName}>{myPerformance.operatorName}</Text>
              <Text style={styles.performanceMeta}>
                {myPerformance.count} vente{myPerformance.count > 1 ? 's' : ''} - {myPerformance.items} article{myPerformance.items > 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.performanceAmount}>{formatCurrency(myPerformance.total)}</Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>Aucune vente trouvee pour votre compte sur cette periode.</Text>
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Performances equipe</Text>
            <Text style={styles.sectionSubtitle}>Classement par chiffre affaires</Text>
          </View>
          <Feather name='users' size={20} color={colors.primary600} />
        </View>

        {performances.length === 0 ? (
          <Text style={styles.emptyText}>Aucune vente sur cette periode.</Text>
        ) : (
          <View style={styles.performanceList}>
            {performances.map((entry, index) => (
              <View key={entry.operatorKey} style={styles.performanceRow}>
                <View style={styles.performanceLeft}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.performanceMain}>
                    <Text style={styles.performanceName}>{entry.operatorName}</Text>
                    <Text style={styles.performanceMeta}>
                      {entry.count} vente{entry.count > 1 ? 's' : ''} - {entry.items} article{entry.items > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <Text style={styles.performanceAmount}>{formatCurrency(entry.total)}</Text>
              </View>
            ))}
          </View>
        )}
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 96,
    gap: spacing.lg,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  kpiCell: {
    width: '47%',
  },
  card: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.neutral500,
    marginTop: 2,
  },
  performanceList: {
    gap: spacing.sm,
  },
  performanceRow: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    backgroundColor: colors.neutral50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    ...shadows.sm,
  },
  performanceLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  performanceMain: {
    flex: 1,
    minWidth: 0,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primary100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    ...typography.captionMedium,
    color: colors.primary600,
  },
  performanceName: {
    ...typography.label,
    color: colors.neutral900,
  },
  performanceMeta: {
    ...typography.caption,
    color: colors.neutral500,
    marginTop: 2,
  },
  performanceAmount: {
    ...typography.label,
    color: colors.neutral900,
    textAlign: 'right',
  },
  emptyText: {
    ...typography.label,
    color: colors.neutral500,
  },
});
