import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { listInvoices, listSales } from '../api/services';
import { getErrorMessage } from '../api/errors';
import { formatCurrency, formatDate } from '../utils/format';
import type { InvoiceResponseDTO, InvoiceStatus, SaleResponseDTO } from '../types/api';

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

const STATUS_META: Record<InvoiceStatus, { label: string; color: string; background: string }> = {
  PAYE: { label: 'Payee', color: '#0F766E', background: '#CCFBF1' },
  IMPAYE: { label: 'Impayee', color: '#B91C1C', background: '#FEE2E2' },
  PARTIEL: { label: 'Partielle', color: '#7C3AED', background: '#EDE9FE' },
};

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

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Ventes</Text>
          <Text style={styles.subtitle}>GET /sales + GET /invoices</Text>
        </View>

        <View style={styles.searchBox}>
          <Feather name='search' size={18} color='#9CA3AF' style={styles.searchIcon} />
          <TextInput
            placeholder='Rechercher un client...'
            placeholderTextColor='#9CA3AF'
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {[
            { key: 'all' as const, label: 'Toutes' },
            { key: 'PAYE' as const, label: 'Payees' },
            { key: 'IMPAYE' as const, label: 'Impayees' },
            { key: 'PARTIEL' as const, label: 'Partielles' },
          ].map((item) => {
            const isActive = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color='#4338CA' />
            <Text style={styles.centeredText}>Chargement ventes...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorTitle}>Erreur ventes</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadSales()}>
              <Text style={styles.retryText}>Reessayer</Text>
            </Pressable>
          </View>
        ) : filteredSales.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.centeredText}>Aucune vente</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredSales.map((sale) => {
              const meta = STATUS_META[sale.status];
              return (
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
                      <View style={[styles.statusBadge, { backgroundColor: meta.background }]}>
                        <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={onCreateNew}>
        <Feather name='plus' size={24} color='#FFFFFF' />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  searchBox: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    top: 14,
  },
  searchInput: {
    paddingVertical: 12,
    paddingLeft: 44,
    paddingRight: 16,
    fontSize: 16,
    color: '#111827',
  },
  filters: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  filterChipActive: {
    backgroundColor: '#4338CA',
    borderColor: '#4338CA',
  },
  filterLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  centered: {
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  centeredText: {
    color: '#6B7280',
  },
  errorTitle: {
    fontWeight: '700',
    color: '#B91C1C',
  },
  errorText: {
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E0E7FF',
  },
  retryText: {
    color: '#4338CA',
    fontWeight: '700',
  },
  list: {
    marginTop: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E0E7FF',
  },
  tagText: {
    fontSize: 12,
    color: '#4338CA',
    fontWeight: '600',
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 13,
    color: '#6B7280',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: '#4338CA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
