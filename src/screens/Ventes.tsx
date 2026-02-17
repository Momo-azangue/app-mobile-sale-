import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { StatusBadge } from '../components/common/StatusBadge';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SearchField } from '../components/common/SearchField';
import { ChipGroup, type ChipOption } from '../components/common/ChipGroup';

interface VentesScreenProps {
  onCreateNew: () => void;
  refreshSignal: number;
}

interface SaleCardData {
  id: string;
  clientName: string;
  montantTotal: number;
  status: InvoiceStatus;
  date?: string;
  items: number;
  consignment: boolean;
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
      clientName: sale.clientName,
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

  const loadSales = useCallback(async () => {
    setLoading(true);
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
    void loadSales();
  }, [loadSales, refreshSignal]);

  const salesCards = useMemo(() => toSaleCards(sales, invoices), [sales, invoices]);

  const filteredSales = useMemo(() => {
    return salesCards.filter((sale) => {
      const matchQuery = sale.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFilter = filter === 'all' ? true : sale.status === filter;
      return matchQuery && matchFilter;
    });
  }, [salesCards, searchTerm, filter]);

  const filterOptions = useMemo<ChipOption[]>(
    () => [
      { label: 'Toutes', value: 'all' },
      { label: 'Payees', value: 'PAYE' },
      { label: 'Impayees', value: 'IMPAYE' },
      { label: 'Partielles', value: 'PARTIEL' },
    ],
    [],
  );

  if (loading) {
    return <LoadingState message='Chargement ventes...' />;
  }

  if (error) {
    return <ErrorState title='Erreur ventes' message={error} onRetry={() => void loadSales()} />;
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title='Ventes' subtitle='Historique des ventes et suivi facturation' />

        <SearchField
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder='Rechercher un client...'
          style={styles.searchBox}
        />

        <ChipGroup
          options={filterOptions}
          value={filter}
          onChange={(value) => setFilter(value as 'all' | InvoiceStatus)}
          layout='row-scroll'
          tone='soft'
          style={styles.filters}
        />

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
              <View key={sale.id} style={styles.card}>
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
            ))}
          </View>
        )}
      </ScrollView>

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
  searchBox: {
    marginBottom: 16,
  },
  filters: {
    paddingHorizontal: 2,
    paddingTop: 4,
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
