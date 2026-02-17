import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { listClients, listInvoices } from '../api/services';
import { getErrorMessage } from '../api/errors';
import { formatCurrency } from '../utils/format';
import type { InvoiceResponseDTO } from '../types/api';

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
    const key = current.toDateString();
    buckets.set(key, 0);
  }

  for (const invoice of invoices) {
    const matchingDate = normalizeDate(invoice.saleDate ?? invoice.date);

    if (matchingDate) {
      const key = matchingDate.toDateString();
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + invoice.montant);
      }
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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [fetchedInvoices, fetchedClients] = await Promise.all([
        listInvoices(),
        listClients(),
      ]);

      setInvoices(fetchedInvoices);
      setClientsCount(fetchedClients.length);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard, refreshSignal]);

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

    const salesToday = invoices.filter((invoice) => isToday(invoice.saleDate ?? invoice.date)).length;

    return {
      revenueToday,
      invoicesOpenCount: invoicesOpen.length,
      invoicesOpenAmount: invoicesOpen.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      salesToday,
      clientsCount,
      partialCount: invoices.filter((invoice) => invoice.statut === 'PARTIEL').length,
      unpaidCount: invoices.filter((invoice) => invoice.statut === 'IMPAYE').length,
    };
  }, [clientsCount, invoices]);

  const trend = useMemo(() => buildSalesTrend(invoices), [invoices]);
  const maxTrend = Math.max(1, ...trend.map((entry) => entry.value));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color='#4338CA' />
        <Text style={styles.centeredText}>Chargement du dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Erreur dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.title}>Tableau de bord</Text>
        <Text style={styles.subtitle}>Indicateurs calcules depuis l'API</Text>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CA du jour</Text>
          <Text style={styles.cardValue}>{formatCurrency(kpis.revenueToday)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Factures ouvertes</Text>
          <Text style={styles.cardValue}>{kpis.invoicesOpenCount}</Text>
          <Text style={styles.cardCaption}>{formatCurrency(kpis.invoicesOpenAmount)} en attente</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ventes du jour</Text>
          <Text style={styles.cardValue}>{kpis.salesToday}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Clients</Text>
          <Text style={styles.cardValue}>{kpis.clientsCount}</Text>
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
            <Feather name='file-text' size={16} color='#4338CA' />
          </View>
          <Text style={styles.todoText}>{kpis.unpaidCount} factures impayees</Text>
        </View>

        <View style={styles.todoItem}>
          <View style={styles.todoIcon}>
            <Feather name='clock' size={16} color='#4338CA' />
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
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 96,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
  },
  centeredText: {
    color: '#6B7280',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B91C1C',
  },
  errorText: {
    color: '#6B7280',
    textAlign: 'center',
  },
  sectionHeader: {
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  cardValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  cardCaption: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  cardFull: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
    backgroundColor: '#4338CA',
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  todoIcon: {
    backgroundColor: '#E0E7FF',
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
  },
  todoText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
});
