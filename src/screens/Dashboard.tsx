import { useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  getInvoicesSummary,
  getSalesSummary,
  listClientsPage,
  listLowStockProducts,
} from '../api/services';
import { getErrorMessage } from '../api/errors';
import { useFormatCurrency } from '../context/AppSettingsContext';
import type {
  InvoicesSummaryResponseDTO,
  ProductResponseDTO,
  SalesSummaryResponseDTO,
} from '../types/api';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { KPICard } from '../components/common/KPICard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { useCachedResource } from '../hooks/useCachedResource';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface DashboardScreenProps {
  refreshSignal: number;
}

/**
 * Résultat tolérant aux échecs partiels : chaque section du dashboard est
 * indépendante. Si {@code /reports/sales-summary} renvoie 404 alors que
 * {@code /reports/invoices-summary} fonctionne, on affiche tout de même la
 * partie qui marche et on signale l'autre comme indisponible.
 */
type SectionResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface DashboardData {
  salesToday: SectionResult<SalesSummaryResponseDTO>;
  invoices: SectionResult<InvoicesSummaryResponseDTO>;
  lowStock: SectionResult<ProductResponseDTO[]>;
  clientsCount: SectionResult<number>;
}

const LOW_STOCK_PREVIEW_COUNT = 3;

async function safeCall<T>(loader: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { ok: true, value: await loader() };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export function DashboardScreen({ refreshSignal }: DashboardScreenProps) {
  const fmtCurrency = useFormatCurrency();

  const fetchDashboard = useCallback(async (): Promise<DashboardData> => {
    // Promise.all + safeCall : chaque section échoue indépendamment des
    // autres. L'écran affiche donc partiellement même si /reports/* ou
    // /products/low-stock n'est pas encore déployé sur le backend.
    const [salesToday, invoices, lowStock, clientsCount] = await Promise.all([
      safeCall(() => getSalesSummary('today')),
      safeCall(() => getInvoicesSummary()),
      safeCall(() => listLowStockProducts()),
      safeCall(async () => (await listClientsPage({ page: 0, size: 1 })).totalElements),
    ]);
    return { salesToday, invoices, lowStock, clientsCount };
  }, []);

  const { data, loading, error, reload } = useCachedResource({
    key: 'screen.dashboard.v2',
    fetcher: fetchDashboard,
    refreshSignal,
  });
  const { refreshing, onRefresh } = usePullToRefresh(() => reload('silent'));

  const openInvoicesCount = useMemo(
    () => (data?.invoices.ok ? data.invoices.value.partiel + data.invoices.value.impaye : null),
    [data],
  );

  if (loading) {
    return <LoadingState message='Chargement du dashboard...' />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title='Erreur dashboard'
        message={error ?? 'Donnees indisponibles'}
        onRetry={() => void reload('blocking')}
      />
    );
  }

  const { salesToday, invoices, lowStock, clientsCount } = data;

  const lowStockList = lowStock.ok ? lowStock.value : [];
  const lowStockPreview = lowStockList.slice(0, LOW_STOCK_PREVIEW_COUNT);
  const lowStockExtra = lowStockList.length - lowStockPreview.length;

  const allOk = salesToday.ok && invoices.ok && lowStock.ok && clientsCount.ok;
  const nothingTodo =
    invoices.ok && invoices.value.impaye === 0 && invoices.value.partiel === 0 && lowStockList.length === 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
      }
    >
      <ScreenHeader title='Dashboard' subtitle='Vue business en temps reel' />

      {!allOk ? (
        <View style={styles.serverHint}>
          <Feather name='wifi-off' size={14} color={colors.warning600} />
          <Text style={styles.serverHintText}>
            Certaines donnees sont indisponibles. Verifiez que le backend est a jour
            (endpoints /reports/*, /products/low-stock).
          </Text>
        </View>
      ) : null}

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCell}>
          <KPICard
            title='CA du jour'
            value={salesToday.ok ? fmtCurrency(salesToday.value.total) : '—'}
            icon='dollar-sign'
            trend={
              salesToday.ok && salesToday.value.unpaidTotal > 0
                ? { value: `${fmtCurrency(salesToday.value.unpaidTotal)} a encaisser`, positive: false }
                : undefined
            }
          />
        </View>
        <View style={styles.kpiCell}>
          <KPICard
            title='Factures ouvertes'
            value={openInvoicesCount ?? '—'}
            icon='file-text'
            trend={
              invoices.ok
                ? { value: fmtCurrency(invoices.value.totalDue), positive: false }
                : undefined
            }
          />
        </View>
        <View style={styles.kpiCell}>
          <KPICard
            title='Ventes du jour'
            value={salesToday.ok ? salesToday.value.count : '—'}
            icon='shopping-cart'
          />
        </View>
        <View style={styles.kpiCell}>
          <KPICard
            title='Clients enregistres'
            value={clientsCount.ok ? clientsCount.value : '—'}
            icon='users'
          />
        </View>
      </View>

      <View style={styles.cardFull}>
        <Text style={styles.cardTitle}>A faire</Text>

        {nothingTodo ? (
          <View style={styles.emptyTodoRow}>
            <Feather name='check-circle' size={16} color={colors.success600} />
            <Text style={styles.emptyTodoText}>Tout est a jour. Bonne journee !</Text>
          </View>
        ) : null}

        {invoices.ok && invoices.value.impaye > 0 ? (
          <View style={styles.todoItem}>
            <View style={styles.todoIcon}>
              <Feather name='alert-triangle' size={16} color={colors.danger600} />
            </View>
            <Text style={styles.todoText}>{invoices.value.impaye} factures impayees</Text>
          </View>
        ) : null}

        {invoices.ok && invoices.value.partiel > 0 ? (
          <View style={styles.todoItem}>
            <View style={styles.todoIcon}>
              <Feather name='clock' size={16} color={colors.warning600} />
            </View>
            <Text style={styles.todoText}>{invoices.value.partiel} factures partielles</Text>
          </View>
        ) : null}

        {!invoices.ok ? (
          <Text style={styles.sectionUnavailable}>
            Resume factures indisponible — {invoices.error}
          </Text>
        ) : null}

        {lowStock.ok && lowStockList.length > 0 ? (
          <View style={[styles.todoItem, styles.todoItemColumn]}>
            <View style={styles.todoHeaderRow}>
              <View style={styles.todoIcon}>
                <Feather name='package' size={16} color={colors.warning600} />
              </View>
              <Text style={styles.todoText}>
                {lowStockList.length} produits en stock faible
              </Text>
            </View>
            <View style={styles.lowStockList}>
              {lowStockPreview.map((product) => (
                <Text key={product.id} style={styles.lowStockItem} numberOfLines={1}>
                  {`• ${product.name} — ${product.quantity ?? 0} restants`}
                </Text>
              ))}
              {lowStockExtra > 0 ? (
                <Text style={styles.lowStockExtra}>{`+ ${lowStockExtra} autres`}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {!lowStock.ok ? (
          <Text style={styles.sectionUnavailable}>
            Alerte stock faible indisponible — {lowStock.error}
          </Text>
        ) : null}
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
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral100,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  todoItemColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  todoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  lowStockList: {
    marginTop: 8,
    paddingLeft: 44,
  },
  lowStockItem: {
    ...typography.caption,
    color: colors.neutral700,
    marginTop: 2,
  },
  lowStockExtra: {
    ...typography.caption,
    color: colors.neutral500,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyTodoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  emptyTodoText: {
    ...typography.label,
    color: colors.neutral600,
  },
  serverHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    backgroundColor: colors.warning100,
    borderRadius: radius.md,
  },
  serverHintText: {
    flex: 1,
    ...typography.caption,
    color: colors.warning600,
  },
  sectionUnavailable: {
    marginTop: 12,
    ...typography.caption,
    color: colors.neutral500,
    fontStyle: 'italic',
  },
});
