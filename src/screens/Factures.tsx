import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  createInvoice,
  createInvoiceFromSale,
  downloadInvoicePdf,
  listInvoices,
  listSales,
  recordInvoicePayment,
} from '../api/services';
import { getErrorMessage } from '../api/errors';
import { API_BASE_URL } from '../config/env';
import { useAuth } from '../context/AuthContext';
import type {
  InvoiceResponseDTO,
  InvoiceStatus,
  PaymentMethod,
  SaleResponseDTO,
} from '../types/api';
import { formatCurrency, formatDate } from '../utils/format';
import { colors, radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { AppButton } from '../components/common/AppButton';
import { AppCard } from '../components/common/AppCard';
import { ChipGroup, type ChipOption } from '../components/common/ChipGroup';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { FormModal } from '../components/common/FormModal';
import { InputField } from '../components/common/InputField';
import { LoadingState } from '../components/common/LoadingState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SearchField } from '../components/common/SearchField';
import { SegmentedControl, type SegmentedOption } from '../components/common/SegmentedControl';
import { StatusBadge } from '../components/common/StatusBadge';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface FacturesScreenProps {
  refreshSignal: number;
}

function parsePositiveAmount(raw: string): number | null {
  const parsed = Number(raw.replace(',', '.').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toPdfUrl(invoiceId: string): string {
  const normalizedBase = API_BASE_URL.replace(/\/$/, '');
  return `${normalizedBase}/api/v1/invoices/${invoiceId}/pdf`;
}

export function FacturesScreen({ refreshSignal }: FacturesScreenProps) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceResponseDTO[]>([]);
  const [sales, setSales] = useState<SaleResponseDTO[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');

  const [showManualModal, setShowManualModal] = useState(false);
  const [showFromSaleModal, setShowFromSaleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [manualClientName, setManualClientName] = useState('');
  const [manualClientEmail, setManualClientEmail] = useState('');
  const [manualClientPhone, setManualClientPhone] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualDueDate, setManualDueDate] = useState('');

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceResponseDTO | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  const loadData = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);
    try {
      const [fetchedInvoices, fetchedSales] = await Promise.all([listInvoices(), listSales()]);
      setInvoices(fetchedInvoices);
      setSales(fetchedSales);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData, refreshSignal]);
  const { refreshing, onRefresh } = usePullToRefresh(() => loadData(false));

  const statusOptions = useMemo<ChipOption[]>(
    () => [
      { label: 'Toutes', value: 'all' },
      { label: 'Payees', value: 'PAYE' },
      { label: 'Partielles', value: 'PARTIEL' },
      { label: 'Impayees', value: 'IMPAYE' },
    ],
    []
  );

  const paymentOptions = useMemo<SegmentedOption[]>(
    () => [
      { label: 'Cash', value: 'CASH' },
      { label: 'Mobile', value: 'MOBILE_MONEY' },
      { label: 'Carte', value: 'CARTE' },
    ],
    []
  );

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const blob = `${invoice.invoiceNumber} ${invoice.clientName} ${invoice.clientEmail ?? ''}`.toLowerCase();
      const matchesQuery = blob.includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'all' ? true : invoice.statut === filter;
      return matchesQuery && matchesFilter;
    });
  }, [filter, invoices, searchTerm]);

  const closeManualModal = () => {
    setShowManualModal(false);
    setManualClientName('');
    setManualClientEmail('');
    setManualClientPhone('');
    setManualAmount('');
    setManualDueDate('');
  };

  const closeFromSaleModal = () => {
    setShowFromSaleModal(false);
    setSelectedSaleId(null);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setPaymentAmount('');
    setPaymentMethod('CASH');
  };

  const handleCreateManualInvoice = async () => {
    if (!manualClientName.trim()) {
      Alert.alert('Validation', 'Le nom du client est obligatoire.');
      return;
    }

    const amount = parsePositiveAmount(manualAmount);
    if (!amount) {
      Alert.alert('Validation', 'Le montant doit etre un nombre positif.');
      return;
    }

    let dueDateIso: string | undefined;
    if (manualDueDate.trim()) {
      const parsedDate = new Date(manualDueDate.trim());
      if (Number.isNaN(parsedDate.getTime())) {
        Alert.alert('Validation', 'Date d echeance invalide (format recommande: YYYY-MM-DD).');
        return;
      }
      dueDateIso = parsedDate.toISOString();
    }

    setSaving(true);
    try {
      await createInvoice({
        clientName: manualClientName.trim(),
        clientEmail: manualClientEmail.trim() || undefined,
        clientPhone: manualClientPhone.trim() || undefined,
        montant: amount,
        date: new Date().toISOString(),
        dueDate: dueDateIso,
        lines: [],
      });

      closeManualModal();
      await loadData();
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInvoiceFromSale = async () => {
    if (!selectedSaleId) {
      Alert.alert('Validation', 'Selectionnez une vente.');
      return;
    }

    setSaving(true);
    try {
      await createInvoiceFromSale(selectedSaleId);
      closeFromSaleModal();
      await loadData();
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = (invoice: InvoiceResponseDTO) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.balanceDue > 0 ? invoice.balanceDue.toFixed(2) : '');
    setPaymentMethod('CASH');
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) {
      return;
    }

    const amount = parsePositiveAmount(paymentAmount);
    if (!amount) {
      Alert.alert('Validation', 'Le montant de paiement doit etre positif.');
      return;
    }

    setSaving(true);
    try {
      await recordInvoicePayment(selectedInvoice.id, {
        montant: amount,
        moyen: paymentMethod,
      });

      closePaymentModal();
      await loadData();
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async (invoice: InvoiceResponseDTO) => {
    setDownloadingInvoiceId(invoice.id);
    try {
      if (Platform.OS === 'web') {
        const bytes = await downloadInvoicePdf(invoice.id);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = (globalThis as any).document?.createElement?.('a');

        if (!anchor) {
          throw new Error('Telechargement PDF indisponible sur ce navigateur.');
        }

        anchor.href = objectUrl;
        anchor.download = `${invoice.invoiceNumber || invoice.id}.pdf`;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        if (!session?.accessToken || !session.tenantId) {
          throw new Error('Session invalide pour le telechargement PDF.');
        }

        const target = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}invoice-${invoice.id}.pdf`;
        const downloaded = await FileSystem.downloadAsync(toPdfUrl(invoice.id), target, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'X-Tenant-Id': session.tenantId,
            Accept: 'application/pdf',
          },
        });

        const shareAvailable = await Sharing.isAvailableAsync();
        if (shareAvailable) {
          await Sharing.shareAsync(downloaded.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Partager la facture PDF',
          });
        } else {
          Alert.alert('PDF telecharge', downloaded.uri);
        }
      }
    } catch (downloadError) {
      Alert.alert('Erreur PDF', getErrorMessage(downloadError));
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  if (loading) {
    return <LoadingState message='Chargement factures...' />;
  }

  if (error) {
    return <ErrorState title='Erreur factures' message={error} onRetry={() => void loadData()} />;
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
        }
      >
        <ScreenHeader title='Factures' subtitle='Creation, paiements et PDF' />

        <View style={styles.topActions}>
          <View style={styles.topActionItem}>
            <AppButton label='Facture manuelle' onPress={() => setShowManualModal(true)} />
          </View>
          <View style={styles.topActionItem}>
            <AppButton label='Depuis une vente' variant='ghost' onPress={() => setShowFromSaleModal(true)} />
          </View>
        </View>

        <SearchField
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder='Rechercher une facture...'
        />

        <ChipGroup
          options={statusOptions}
          value={filter}
          onChange={(value) => setFilter(value as 'all' | InvoiceStatus)}
          layout='row-scroll'
          tone='soft'
          style={styles.filters}
        />

        {filteredInvoices.length === 0 ? (
          <EmptyState
            icon='file-text'
            title='Aucune facture'
            description='Creez une facture manuelle ou depuis une vente.'
            actionLabel='Creer facture'
            onAction={() => setShowManualModal(true)}
          />
        ) : (
          <View style={styles.list}>
            {filteredInvoices.map((invoice) => (
              <AppCard key={invoice.id} style={styles.invoiceCard}>
                <View style={styles.invoiceHeader}>
                  <View style={styles.invoiceHeaderLeft}>
                    <Text style={styles.invoiceNumber}>{invoice.invoiceNumber || `Facture ${invoice.id}`}</Text>
                    <Text style={styles.invoiceClient}>{invoice.clientName || 'Client'}</Text>
                  </View>
                  <StatusBadge status={invoice.statut} />
                </View>

                <View style={styles.invoiceMetaRow}>
                  <Text style={styles.metaLabel}>Montant</Text>
                  <Text style={styles.metaValue}>{formatCurrency(invoice.montant)}</Text>
                </View>
                <View style={styles.invoiceMetaRow}>
                  <Text style={styles.metaLabel}>Deja paye</Text>
                  <Text style={styles.metaValue}>{formatCurrency(invoice.amountPaid)}</Text>
                </View>
                <View style={styles.invoiceMetaRow}>
                  <Text style={styles.metaLabel}>Reste du</Text>
                  <Text style={styles.metaValue}>{formatCurrency(invoice.balanceDue)}</Text>
                </View>
                <View style={styles.invoiceMetaRow}>
                  <Text style={styles.metaLabel}>Date</Text>
                  <Text style={styles.metaValue}>{formatDate(invoice.date)}</Text>
                </View>

                <View style={styles.actionRow}>
                  <View style={styles.actionItem}>
                    <AppButton
                      label='Paiement'
                      variant='outline'
                      disabled={invoice.balanceDue <= 0}
                      onPress={() => openPaymentModal(invoice)}
                    />
                  </View>
                  <View style={styles.actionItem}>
                    <AppButton
                      label={downloadingInvoiceId === invoice.id ? 'PDF...' : 'PDF'}
                      variant='ghost'
                      disabled={downloadingInvoiceId === invoice.id}
                      onPress={() => {
                        void handleDownloadPdf(invoice);
                      }}
                    />
                  </View>
                </View>
              </AppCard>
            ))}
          </View>
        )}
      </ScrollView>

      <FormModal visible={showManualModal} title='Facture manuelle' onClose={closeManualModal}>
        <InputField
          label='Nom client'
          value={manualClientName}
          onChangeText={setManualClientName}
          placeholder='Nom du client'
        />
        <InputField
          label='Email (optionnel)'
          value={manualClientEmail}
          onChangeText={setManualClientEmail}
          placeholder='client@domaine.com'
          autoCapitalize='none'
          keyboardType='email-address'
        />
        <InputField
          label='Telephone (optionnel)'
          value={manualClientPhone}
          onChangeText={setManualClientPhone}
          placeholder='+225000000000'
        />
        <InputField
          label='Montant'
          value={manualAmount}
          onChangeText={setManualAmount}
          placeholder='Ex: 15000'
          keyboardType='numeric'
        />
        <InputField
          label='Echeance (optionnel)'
          value={manualDueDate}
          onChangeText={setManualDueDate}
          placeholder='YYYY-MM-DD'
        />

        <View style={styles.modalActions}>
          <View style={styles.actionItem}>
            <AppButton label='Retour' variant='outline' onPress={closeManualModal} disabled={saving} />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={saving ? 'Creation...' : 'Creer'}
              disabled={saving}
              onPress={() => {
                void handleCreateManualInvoice();
              }}
            />
          </View>
        </View>
      </FormModal>

      <FormModal visible={showFromSaleModal} title='Facture depuis vente' onClose={closeFromSaleModal}>
        {sales.length === 0 ? (
          <Text style={styles.emptySalesText}>Aucune vente disponible.</Text>
        ) : (
          <ScrollView style={styles.salesList}>
            {sales.map((sale) => {
              const selected = selectedSaleId === sale.id;
              return (
                <Pressable
                  key={sale.id}
                  style={[styles.saleItem, selected && styles.saleItemSelected]}
                  onPress={() => setSelectedSaleId(sale.id)}
                >
                  <View style={styles.saleItemHeader}>
                    <Text style={styles.saleItemClient}>{sale.clientName}</Text>
                    {selected ? <Feather name='check-circle' size={18} color={colors.primary600} /> : null}
                  </View>
                  <Text style={styles.saleItemMeta}>{sale.id}</Text>
                  <Text style={styles.saleItemMeta}>{formatCurrency(sale.montantTotal)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.modalActions}>
          <View style={styles.actionItem}>
            <AppButton label='Retour' variant='outline' onPress={closeFromSaleModal} disabled={saving} />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={saving ? 'Creation...' : 'Creer'}
              disabled={saving || !selectedSaleId}
              onPress={() => {
                void handleCreateInvoiceFromSale();
              }}
            />
          </View>
        </View>
      </FormModal>

      <FormModal visible={showPaymentModal} title='Enregistrer paiement' onClose={closePaymentModal}>
        {selectedInvoice ? (
          <View style={styles.paymentSummary}>
            <Text style={styles.paymentSummaryText}>
              Facture: {selectedInvoice.invoiceNumber || selectedInvoice.id}
            </Text>
            <Text style={styles.paymentSummaryText}>
              Reste du: {formatCurrency(selectedInvoice.balanceDue)}
            </Text>
          </View>
        ) : null}

        <InputField
          label='Montant a payer'
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          placeholder='Ex: 10000'
          keyboardType='numeric'
        />

        <View style={styles.paymentMethodWrap}>
          <Text style={styles.methodLabel}>Moyen de paiement</Text>
          <SegmentedControl
            options={paymentOptions}
            value={paymentMethod}
            onChange={(value) => setPaymentMethod(value as PaymentMethod)}
          />
        </View>

        <View style={styles.modalActions}>
          <View style={styles.actionItem}>
            <AppButton label='Retour' variant='outline' onPress={closePaymentModal} disabled={saving} />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={saving ? 'Enregistrement...' : 'Valider'}
              disabled={saving}
              onPress={() => {
                void handleRecordPayment();
              }}
            />
          </View>
        </View>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  topActionItem: {
    flex: 1,
  },
  filters: {
    marginTop: 10,
    paddingHorizontal: 2,
  },
  list: {
    marginTop: 10,
    gap: 12,
  },
  invoiceCard: {
    gap: 8,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  invoiceHeaderLeft: {
    flex: 1,
  },
  invoiceNumber: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  invoiceClient: {
    marginTop: 2,
    ...typography.label,
    color: colors.neutral600,
  },
  invoiceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    ...typography.label,
    color: colors.neutral500,
  },
  metaValue: {
    ...typography.label,
    color: colors.neutral800,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionItem: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  salesList: {
    maxHeight: 260,
  },
  saleItem: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  saleItemSelected: {
    borderColor: colors.primary200,
    backgroundColor: colors.primary50,
  },
  saleItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saleItemClient: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  saleItemMeta: {
    marginTop: 4,
    ...typography.caption,
    color: colors.neutral500,
  },
  paymentSummary: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
    padding: 10,
    gap: 2,
  },
  paymentSummaryText: {
    ...typography.label,
    color: colors.neutral700,
  },
  paymentMethodWrap: {
    gap: 8,
    marginTop: 4,
  },
  methodLabel: {
    ...typography.label,
    color: colors.neutral700,
  },
  emptySalesText: {
    ...typography.label,
    color: colors.neutral600,
  },
});
