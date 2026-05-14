import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { listInvoices, listInvoicesPage, listSales, listSalesPage } from '../api/services';
import { useFormatCurrency } from '../context/AppSettingsContext';
import { formatDate } from '../utils/format';
import type { InvoiceResponseDTO, InvoiceStatus, SaleResponseDTO } from '../types/api';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { FormModal } from '../components/common/FormModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SearchField } from '../components/common/SearchField';
import { ChipGroup, type ChipOption } from '../components/common/ChipGroup';
import { useCachedResource } from '../hooks/useCachedResource';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface VentesScreenProps {
  onCreateNew: () => void;
  refreshSignal: number;
}

interface SaleCardData {
  id: string;
  sale: SaleResponseDTO;
  invoice?: InvoiceResponseDTO;
  clientName: string;
  operatorId?: string;
  operatorName?: string;
  montantTotal: number;
  status: InvoiceStatus;
  date?: string;
  items: number;
  consignment: boolean;
}

interface VentesData {
  sales: SaleResponseDTO[];
  invoices: InvoiceResponseDTO[];
}

type PeriodFilter = 'all' | 'today' | '7d' | '30d';

// Aligné sur la borne {@code @Max(100)} appliquée côté backend (cf.
// SaleController.getAllSales). Au-delà, on bascule sur le bulk via listSales()
// qui itère lui-même via fetchAllPages.
const FILTERED_PAGE_SIZE = 100;

/**
 * Convertit la période sélectionnée en intervalle ISO 8601 que le backend
 * accepte sur {@code GET /sales?from=&to=}. {@code all} renvoie un objet vide
 * (le serveur ne filtrera pas par date).
 */
function periodToRange(period: PeriodFilter): { from?: string; to?: string } {
  if (period === 'all') {
    return {};
  }
  const now = new Date();
  const to = now.toISOString();

  if (period === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to };
  }

  const days = period === '7d' ? 7 : 30;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return { from: start.toISOString(), to };
}

function toSaleCards(sales: SaleResponseDTO[], invoices: InvoiceResponseDTO[]): SaleCardData[] {
  const invoiceBySaleId = new Map<string, InvoiceResponseDTO>();

  for (const invoice of invoices) {
    if (invoice.saleId) {
      invoiceBySaleId.set(invoice.saleId, invoice);
    }
  }

  return sales.map((sale) => {
    const invoice = invoiceBySaleId.get(sale.id);

    return {
      id: sale.id,
      sale,
      invoice,
      clientName: sale.clientName,
      operatorId: sale.operatorId ?? invoice?.operatorId,
      operatorName: sale.operatorName ?? invoice?.operatorName,
      montantTotal: sale.montantTotal,
      status: invoice?.statut ?? 'IMPAYE',
      date: invoice?.saleDate ?? invoice?.date,
      items: sale.products.reduce((sum, item) => sum + item.quantity, 0),
      consignment: Boolean(invoice?.lines?.some((line) => line.consignment)),
    };
  });
}

export function VentesScreen({ onCreateNew, refreshSignal }: VentesScreenProps) {
  const fmtCurrency = useFormatCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [showExtraFilters, setShowExtraFilters] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleCardData | null>(null);

  const range = useMemo(() => periodToRange(periodFilter), [periodFilter]);
  const hasServerFilter = Boolean(range.from);

  const fetchSalesData = useCallback(async (): Promise<VentesData> => {
    if (hasServerFilter) {
      // Côté serveur on ramène uniquement la fenêtre demandée — gain réseau
      // pour les commerces avec un long historique. Le statut paiement
      // reste filtré côté client (jointure ventes ↔ factures).
      const [salesPage, invoicesPage] = await Promise.all([
        listSalesPage({ from: range.from, to: range.to, size: FILTERED_PAGE_SIZE }),
        listInvoicesPage({ from: range.from, to: range.to, size: FILTERED_PAGE_SIZE }),
      ]);
      return { sales: salesPage.content, invoices: invoicesPage.content };
    }
    // Pas de filtre période : on garde le bulk avec cache offline.
    const [fetchedSales, fetchedInvoices] = await Promise.all([listSales(), listInvoices()]);
    return { sales: fetchedSales, invoices: fetchedInvoices };
  }, [hasServerFilter, range.from, range.to]);

  const { data, loading, error, reload } = useCachedResource({
    // Clé du cache mémoire dépend de la fenêtre serveur — un changement de
    // période déclenche un re-fetch propre sans collisions.
    key: hasServerFilter ? `screen.ventes:${range.from}:${range.to}` : 'screen.ventes',
    fetcher: fetchSalesData,
    refreshSignal,
  });
  const { refreshing, onRefresh } = usePullToRefresh(() => reload('silent'));

  const sales = data?.sales ?? [];
  const invoices = data?.invoices ?? [];

  const salesCards = useMemo(() => toSaleCards(sales, invoices), [sales, invoices]);

  const filteredSales = useMemo(() => {
    // La période est désormais filtrée côté serveur (cf. fetchSalesData) ;
    // on ne fait plus de matchPeriod en local. Restent en client : statut
    // paiement (qui dépend de la jointure facture) et la recherche libre.
    return salesCards.filter((sale) => {
      const lowerQuery = searchTerm.toLowerCase();
      const matchQuery =
        sale.clientName.toLowerCase().includes(lowerQuery)
        || String(sale.montantTotal).includes(lowerQuery);
      const matchFilter = filter === 'all' ? true : sale.status === filter;
      return matchQuery && matchFilter;
    });
  }, [filter, salesCards, searchTerm]);

  const filterOptions = useMemo<ChipOption[]>(
    () => [
      { label: 'Toutes', value: 'all' },
      { label: 'Payees', value: 'PAYE' },
      { label: 'Impayees', value: 'IMPAYE' },
      { label: 'Partielles', value: 'PARTIEL' },
    ],
    [],
  );
  const periodOptions = useMemo<ChipOption[]>(
    () => [
      { label: 'Toutes dates', value: 'all' },
      { label: 'Aujourd hui', value: 'today' },
      { label: '7 jours', value: '7d' },
      { label: '30 jours', value: '30d' },
    ],
    [],
  );
  const extraFilterCount = periodFilter === 'all' ? 0 : 1;

  if (loading) {
    return <LoadingState message='Chargement ventes...' />;
  }

  if (error) {
    return <ErrorState title='Erreur ventes' message={error} onRetry={() => void reload('blocking')} />;
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
        }
      >
        <ScreenHeader title='Ventes' subtitle='Historique des ventes et suivi facturation' />

        <View style={styles.searchRow}>
          <SearchField
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder='Rechercher client ou montant...'
            style={styles.searchField}
          />
          <Pressable
            style={[styles.filterButton, showExtraFilters && styles.filterButtonActive]}
            onPress={() => setShowExtraFilters((current) => !current)}
          >
            <Feather name='sliders' size={16} color={showExtraFilters ? colors.white : colors.neutral700} />
            <Text style={[styles.filterButtonLabel, showExtraFilters && styles.filterButtonLabelActive]}>
              Filtrer
            </Text>
            {extraFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{extraFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <ChipGroup
          options={filterOptions}
          value={filter}
          onChange={(value) => setFilter(value as 'all' | InvoiceStatus)}
          layout='row-scroll'
          tone='soft'
          style={styles.filters}
        />
        {showExtraFilters ? (
          <View style={styles.extraFiltersWrap}>
            <ChipGroup
              options={periodOptions}
              value={periodFilter}
              onChange={(value) => setPeriodFilter(value as PeriodFilter)}
              layout='row-scroll'
              tone='soft'
              style={styles.filters}
            />
            <Pressable onPress={() => setPeriodFilter('all')} hitSlop={8}>
              <Text style={styles.resetLabel}>Reinitialiser</Text>
            </Pressable>
          </View>
        ) : null}

        {filteredSales.length === 0 ? (
          <EmptyState
            icon='shopping-cart'
            title='Aucune vente'
            description='Commencez par creer une vente pour suivre vos revenus.'
            actionLabel='Nouvelle vente'
            onAction={onCreateNew}
          />
        ) : (
          <View style={styles.list}>
            {filteredSales.map((sale) => (
              <Pressable key={sale.id} onPress={() => setSelectedSale(sale)}>
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardLeft}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.client}>{sale.clientName}</Text>
                        {sale.consignment ? (
                          <View style={styles.tag}>
                            <Text style={styles.tagText}>Consignation</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.cardMeta}>
                        {sale.items} article(s) - {formatDate(sale.date)}
                      </Text>
                    </View>

                    <View style={styles.cardRight}>
                      <Text style={styles.amount}>{fmtCurrency(sale.montantTotal)}</Text>
                      <StatusBadge status={sale.status} />
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <FormModal
        visible={selectedSale != null}
        title='Detail vente'
        onClose={() => setSelectedSale(null)}
      >
        {selectedSale ? (
          <View style={styles.detailWrap}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Client</Text>
              <Text style={styles.detailValue}>{selectedSale.clientName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vendeur</Text>
              <Text style={styles.detailValue}>{selectedSale.operatorName ?? 'Utilisateur'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatDate(selectedSale.date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Statut facture</Text>
              <StatusBadge status={selectedSale.status} />
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Montant total</Text>
              <Text style={styles.detailValue}>{fmtCurrency(selectedSale.montantTotal)}</Text>
            </View>

            <Text style={styles.linesTitle}>Lignes produits</Text>
            <View style={styles.linesList}>
              {selectedSale.sale.products.map((line, index) => {
                const lineTotal = Number.isFinite(line.priceAtSale)
                  ? line.quantity * (line.priceAtSale as number)
                  : null;
                return (
                  <View key={`${line.productId}-${index}`} style={styles.lineItem}>
                    <Text style={styles.lineName}>{line.productName ?? line.productId}</Text>
                    <Text style={styles.lineMeta}>Quantite: {line.quantity}</Text>
                    <Text style={styles.lineMeta}>
                      Prix: {Number.isFinite(line.priceAtSale) ? fmtCurrency(line.priceAtSale as number) : '-'}
                    </Text>
                    <Text style={styles.lineMeta}>Total: {lineTotal != null ? fmtCurrency(lineTotal) : '-'}</Text>
                    {line.serialNumbers && line.serialNumbers.length > 0 ? (
                      <Text style={styles.lineMeta}>IMEI: {line.serialNumbers.join(', ')}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </FormModal>

      <Pressable style={styles.fab} onPress={onCreateNew}>
        <Feather name='plus' size={24} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  searchRow: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchField: {
    flex: 1,
  },
  filterButton: {
    minHeight: 46,
    minWidth: 96,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral300,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadows.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary600,
    borderColor: colors.primary600,
  },
  filterButtonLabel: {
    ...typography.label,
    color: colors.neutral700,
  },
  filterButtonLabelActive: {
    color: colors.white,
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.warning600,
  },
  filterBadgeText: {
    ...typography.captionMedium,
    color: colors.white,
  },
  extraFiltersWrap: {
    marginBottom: 8,
  },
  filters: {
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  resetLabel: {
    ...typography.captionMedium,
    color: colors.primary600,
    paddingHorizontal: 4,
  },
  list: {
    marginTop: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 16,
    ...shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  client: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  tag: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.primary100,
  },
  tagText: {
    ...typography.captionMedium,
    color: colors.primary600,
  },
  cardMeta: {
    marginTop: 6,
    ...typography.caption,
    color: colors.neutral500,
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  amount: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  detailWrap: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  detailLabel: {
    ...typography.label,
    color: colors.neutral500,
  },
  detailValue: {
    ...typography.label,
    color: colors.neutral900,
    flexShrink: 1,
    textAlign: 'right',
  },
  linesTitle: {
    marginTop: 8,
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  linesList: {
    maxHeight: 220,
    gap: 8,
  },
  lineItem: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  lineName: {
    ...typography.label,
    color: colors.neutral900,
  },
  lineMeta: {
    ...typography.caption,
    color: colors.neutral500,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 36,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary600,
    ...shadows.md,
  },
});
