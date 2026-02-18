import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { listInvoices, listSales } from '../api/services';
import { getErrorMessage } from '../api/errors';
import { formatCurrency, formatDate } from '../utils/format';
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

type PeriodFilter = 'all' | 'today' | '7d' | '30d';

function matchPeriod(dateValue: string | undefined, period: PeriodFilter): boolean {
  if (period === 'all') {
    return true;
  }
  if (!dateValue) {
    return false;
  }

  const targetDate = new Date(dateValue);
  if (Number.isNaN(targetDate.getTime())) {
    return false;
  }

  const now = new Date();
  if (period === 'today') {
    const today = now.toDateString();
    return targetDate.toDateString() === today;
  }

  const days = period === '7d' ? 7 : 30;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return targetDate >= start && targetDate <= now;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleResponseDTO[]>([]);
  const [invoices, setInvoices] = useState<InvoiceResponseDTO[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [showExtraFilters, setShowExtraFilters] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleCardData | null>(null);

  const loadSales = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const [fetchedSales, fetchedInvoices] = await Promise.all([listSales(), listInvoices()]);
      setSales(fetchedSales);
      setInvoices(fetchedInvoices);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSales(true);
  }, [loadSales, refreshSignal]);
  const { refreshing, onRefresh } = usePullToRefresh(() => loadSales(false));

  const salesCards = useMemo(() => toSaleCards(sales, invoices), [sales, invoices]);

  const filteredSales = useMemo(() => {
    return salesCards.filter((sale) => {
      const lowerQuery = searchTerm.toLowerCase();
      const matchQuery =
        sale.clientName.toLowerCase().includes(lowerQuery)
        || String(sale.montantTotal).includes(lowerQuery);
      const matchFilter = filter === 'all' ? true : sale.status === filter;
      const matchDate = matchPeriod(sale.date, periodFilter);
      return matchQuery && matchFilter && matchDate;
    });
  }, [filter, periodFilter, salesCards, searchTerm]);

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
    return <ErrorState title='Erreur ventes' message={error} onRetry={() => void loadSales()} />;
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
                      <Text style={styles.amount}>{formatCurrency(sale.montantTotal)}</Text>
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
              <Text style={styles.detailValue}>{formatCurrency(selectedSale.montantTotal)}</Text>
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
                      Prix: {Number.isFinite(line.priceAtSale) ? formatCurrency(line.priceAtSale as number) : '-'}
                    </Text>
                    <Text style={styles.lineMeta}>Total: {lineTotal != null ? formatCurrency(lineTotal) : '-'}</Text>
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
