import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  createInvoice,
  createInvoiceFromSale,
  downloadInvoicePdf,
  listInvoices,
  listInvoicesPage,
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
import { useFormatCurrency } from '../context/AppSettingsContext';
import { formatDate } from '../utils/format';
import { colors, radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { AppButton } from '../components/common/AppButton';
import { AppCard } from '../components/common/AppCard';
import { ChipGroup, type ChipOption } from '../components/common/ChipGroup';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { FormModal } from '../components/common/FormModal';
import { InputField } from '../components/common/InputField';
import { MoneyInput } from '../components/common/MoneyInput';
import { SkeletonList } from '../components/common/SkeletonList';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SearchField } from '../components/common/SearchField';
import { SegmentedControl, type SegmentedOption } from '../components/common/SegmentedControl';
import { StatusBadge } from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import { useCachedResource } from '../hooks/useCachedResource';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface FacturesScreenProps {
  refreshSignal: number;
}

interface FacturesData {
  invoices: InvoiceResponseDTO[];
  sales: SaleResponseDTO[];
}

function parsePositiveAmount(raw: string): number | null {
  const parsed = Number(raw.replace(',', '.').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

const MONEY_EPSILON = 0.000001;

function toPdfUrl(invoiceId: string): string {
  const normalizedBase = API_BASE_URL.replace(/\/$/, '');
  return `${normalizedBase}/api/v1/invoices/${invoiceId}/pdf`;
}

export function FacturesScreen({ refreshSignal }: FacturesScreenProps) {
  const { session } = useAuth();
  const fmtCurrency = useFormatCurrency();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');

  const [showManualModal, setShowManualModal] = useState(false);
  const [showFromSaleModal, setShowFromSaleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [manualClientName, setManualClientName] = useState('');
  const [manualClientEmail, setManualClientEmail] = useState('');
  const [manualClientPhone, setManualClientPhone] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualDueDate, setManualDueDate] = useState('');

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceResponseDTO | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceResponseDTO | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // Aligné sur la borne {@code @Max(100)} appliquée par InvoiceController.
  const FILTERED_PAGE_SIZE = 100;
  const isStatusFiltered = filter !== 'all';

  const fetchFacturesData = useCallback(async (): Promise<FacturesData> => {
    if (isStatusFiltered) {
      // Filtre statut serveur ({@code ?status=PAYE/PARTIEL/IMPAYE}) : on
      // n'a plus besoin de filtrer les factures payées côté client.
      const [invoicesPage, fetchedSales] = await Promise.all([
        listInvoicesPage({ status: filter, size: FILTERED_PAGE_SIZE }),
        listSales(),
      ]);
      return { invoices: invoicesPage.content, sales: fetchedSales };
    }
    const [fetchedInvoices, fetchedSales] = await Promise.all([listInvoices(), listSales()]);
    return { invoices: fetchedInvoices, sales: fetchedSales };
  }, [filter, isStatusFiltered]);

  const { data, loading, error, reload } = useCachedResource({
    // Cache séparé par statut filtré pour éviter les collisions au switch.
    key: isStatusFiltered ? `screen.factures:status=${filter}` : 'screen.factures',
    fetcher: fetchFacturesData,
    refreshSignal,
  });

  const loadData = useCallback(
    async (showLoader: boolean = true) => {
      await reload(showLoader ? 'blocking' : 'silent');
    },
    [reload]
  );
  const { refreshing, onRefresh } = usePullToRefresh(() => loadData(false));

  const invoices = data?.invoices ?? [];
  const sales = data?.sales ?? [];

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
    // Le statut est désormais filtré côté serveur (cf. fetchFacturesData) ;
    // on garde seulement la recherche libre côté client.
    return invoices.filter((invoice) => {
      const blob = `${invoice.invoiceNumber} ${invoice.clientName} ${invoice.clientEmail ?? ''}`.toLowerCase();
      return blob.includes(searchTerm.toLowerCase());
    });
  }, [invoices, searchTerm]);

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

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailInvoice(null);
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
      await loadData(false);
      toast.success('Facture creee.');
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
      await loadData(false);
      toast.success('Facture creee depuis la vente.');
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

  const openDetailModal = (invoice: InvoiceResponseDTO) => {
    setDetailInvoice(invoice);
    setShowDetailModal(true);
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
    if (amount - selectedInvoice.balanceDue > MONEY_EPSILON) {
      Alert.alert(
        'Validation',
        `Le montant saisi depasse le reste du (${fmtCurrency(selectedInvoice.balanceDue)}).`
      );
      return;
    }

    setSaving(true);
    try {
      await recordInvoicePayment(selectedInvoice.id, {
        montant: amount,
        moyen: paymentMethod,
      });

      closePaymentModal();
      await loadData(false);
      toast.success('Paiement enregistre.');
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
        toast.success('PDF telecharge.');
      } else {
        if (!session?.accessToken) {
          throw new Error('Session invalide pour le telechargement PDF.');
        }

        const target = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}invoice-${invoice.id}.pdf`;
        const downloaded = await FileSystem.downloadAsync(toPdfUrl(invoice.id), target, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
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
          toast.success('PDF telecharge.');
        }
      }
    } catch (downloadError) {
      Alert.alert('Erreur PDF', getErrorMessage(downloadError));
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  if (loading) {
    return <SkeletonList />;
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
                  <Text style={styles.metaValue}>{fmtCurrency(invoice.montant)}</Text>
                </View>
                <View style={styles.invoiceMetaRow}>
                  <Text style={styles.metaLabel}>Deja paye</Text>
                  <Text style={styles.metaValue}>{fmtCurrency(invoice.amountPaid)}</Text>
                </View>
                <View style={styles.invoiceMetaRow}>
                  <Text style={styles.metaLabel}>Reste du</Text>
                  <Text style={styles.metaValue}>{fmtCurrency(invoice.balanceDue)}</Text>
                </View>
                <View style={styles.invoiceMetaRow}>
                  <Text style={styles.metaLabel}>Date</Text>
                  <Text style={styles.metaValue}>{formatDate(invoice.date)}</Text>
                </View>
                <View style={styles.invoiceMetaRow}>
                  <Text style={styles.metaLabel}>Vendeur</Text>
                  <Text style={styles.metaValue}>{invoice.operatorName || 'Utilisateur'}</Text>
                </View>

                <View style={styles.actionRow}>
                  <View style={styles.actionItem}>
                    <AppButton
                      label='Detail'
                      variant='ghost'
                      onPress={() => openDetailModal(invoice)}
                    />
                  </View>
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
        <MoneyInput
          label='Montant'
          value={manualAmount}
          onChangeText={setManualAmount}
          placeholder='15 000'
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
                  <Text style={styles.saleItemMeta}>{fmtCurrency(sale.montantTotal)}</Text>
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
              Reste du: {fmtCurrency(selectedInvoice.balanceDue)}
            </Text>
          </View>
        ) : null}

        <MoneyInput
          label='Montant a payer'
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          placeholder='10 000'
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

      <FormModal visible={showDetailModal} title='Detail facture' onClose={closeDetailModal}>
        {detailInvoice ? (
          <View style={styles.paymentSummary}>
            <Text style={styles.paymentSummaryText}>Facture: {detailInvoice.invoiceNumber || detailInvoice.id}</Text>
            <Text style={styles.paymentSummaryText}>Client: {detailInvoice.clientName || '-'}</Text>
            <Text style={styles.paymentSummaryText}>Vendeur: {detailInvoice.operatorName || 'Utilisateur'}</Text>
            <Text style={styles.paymentSummaryText}>Date: {formatDate(detailInvoice.date)}</Text>
            <Text style={styles.paymentSummaryText}>Echeance: {formatDate(detailInvoice.dueDate)}</Text>
            <Text style={styles.paymentSummaryText}>Statut: {detailInvoice.statut}</Text>
            <Text style={styles.paymentSummaryText}>Montant: {fmtCurrency(detailInvoice.montant)}</Text>
            <Text style={styles.paymentSummaryText}>Deja paye: {fmtCurrency(detailInvoice.amountPaid)}</Text>
            <Text style={styles.paymentSummaryText}>Reste du: {fmtCurrency(detailInvoice.balanceDue)}</Text>
          </View>
        ) : null}

        <Text style={styles.methodLabel}>Lignes facture</Text>
        {detailInvoice?.lines?.length ? (
          <ScrollView style={styles.salesList}>
            {detailInvoice.lines.map((line, index) => (
              <View key={`${line.productId ?? line.productName ?? index}-${index}`} style={styles.saleItem}>
                <Text style={styles.saleItemClient}>{line.productName ?? line.productId ?? 'Produit'}</Text>
                <Text style={styles.saleItemMeta}>Quantite: {line.quantity}</Text>
                <Text style={styles.saleItemMeta}>Prix unitaire: {fmtCurrency(line.unitPrice)}</Text>
                <Text style={styles.saleItemMeta}>Total: {fmtCurrency(line.total)}</Text>
                {line.serialNumbers && line.serialNumbers.length > 0 ? (
                  <Text style={styles.saleItemMeta}>IMEI: {line.serialNumbers.join(', ')}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptySalesText}>Aucune ligne.</Text>
        )}

        <View style={styles.modalActions}>
          <View style={styles.actionItem}>
            <AppButton label='Fermer' variant='outline' onPress={closeDetailModal} />
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
