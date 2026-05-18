import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  createProvider,
  deleteProvider,
  getSupplierAccounts,
  listProviders,
  recordSupplierPayment,
  updateProvider,
} from '../api/services';
import { getErrorMessage } from '../api/errors';
import type { PaymentMethod, ProviderResponseDTO, SupplierAccountResponseDTO } from '../types/api';
import { useFormatCurrency } from '../context/AppSettingsContext';
import { colors } from '../theme/tokens';
import { typography } from '../theme/typography';
import { AppButton } from '../components/common/AppButton';
import { AppCard } from '../components/common/AppCard';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { FloatingActionButton } from '../components/common/FloatingActionButton';
import { FormModal } from '../components/common/FormModal';
import { InputField } from '../components/common/InputField';
import { SkeletonList } from '../components/common/SkeletonList';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SearchField } from '../components/common/SearchField';
import { SegmentedControl, type SegmentedOption } from '../components/common/SegmentedControl';
import { useToast } from '../components/common/ToastProvider';
import { useCachedResource } from '../hooks/useCachedResource';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface FournisseursScreenProps {
  refreshSignal: number;
}

type FournisseursTab = 'dettes' | 'fournisseurs';

interface FournisseursResource {
  providers: ProviderResponseDTO[];
  supplierAccounts: SupplierAccountResponseDTO[];
}

const TAB_OPTIONS: SegmentedOption[] = [
  { label: 'Dettes', value: 'dettes' },
  { label: 'Fournisseurs', value: 'fournisseurs' },
];

const PAYMENT_METHOD_OPTIONS: SegmentedOption[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Mobile', value: 'MOBILE_MONEY' },
  { label: 'Carte', value: 'CARTE' },
];

const LEDGER_TYPE_LABELS = {
  CONSIGNMENT_IN: 'Stock consigne recu',
  CONSIGNED_SALE: 'Vente consignee',
  SUPPLIER_PAYMENT: 'Reglement fournisseur',
  CONSIGNMENT_RETURN: 'Retour consignation',
} as const;

export function FournisseursScreen({ refreshSignal }: FournisseursScreenProps) {
  const formatCurrency = useFormatCurrency();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<FournisseursTab>('dettes');
  const [expandedAccountIds, setExpandedAccountIds] = useState<string[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentProviderId, setPaymentProviderId] = useState<string | null>(null);
  const [paymentProviderName, setPaymentProviderName] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  const fetchFournisseursResource = useCallback(async (): Promise<FournisseursResource> => {
    const [providers, supplierAccounts] = await Promise.all([
      listProviders(),
      getSupplierAccounts(),
    ]);
    return { providers, supplierAccounts };
  }, []);

  const { data, loading, error, reload } = useCachedResource({
    key: 'screen.fournisseurs',
    fetcher: fetchFournisseursResource,
    refreshSignal,
  });

  const loadFournisseurs = useCallback(
    async (showLoader: boolean = true) => {
      await reload(showLoader ? 'blocking' : 'silent');
    },
    [reload]
  );
  const { refreshing, onRefresh } = usePullToRefresh(() => loadFournisseurs(false));
  const providers = data?.providers ?? [];
  const supplierAccounts = data?.supplierAccounts ?? [];

  const filteredProviders = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return providers.filter((provider) => {
      const blob = `${provider.name} ${provider.email ?? ''} ${provider.phone ?? ''} ${provider.address ?? ''}`.toLowerCase();
      return blob.includes(lower);
    });
  }, [providers, searchTerm]);

  const toggleAccountExpansion = (providerId: string) => {
    setExpandedAccountIds((current) =>
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId],
    );
  };

  const openPaymentModal = (account: SupplierAccountResponseDTO) => {
    setPaymentProviderId(account.providerId);
    setPaymentProviderName(account.providerName || account.providerId);
    setPaymentAmount(account.balanceDue > 0 ? String(account.balanceDue) : '');
    setPaymentMethod('CASH');
    setPaymentReference('');
    setPaymentNote('');
    setShowPaymentForm(true);
  };

  const closePaymentModal = () => {
    setShowPaymentForm(false);
    setPaymentProviderId(null);
    setPaymentProviderName('');
    setPaymentAmount('');
    setPaymentMethod('CASH');
    setPaymentReference('');
    setPaymentNote('');
  };

  const parseAmount = (rawValue: string) => Number(rawValue.replace(',', '.').trim());

  const formatDate = (value?: string) => {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleDateString();
  };

  const formatLineAmount = (lineType: SupplierAccountResponseDTO['lines'][number]['type'], amount: number) => {
    if (lineType === 'SUPPLIER_PAYMENT') {
      return `-${formatCurrency(amount)}`;
    }
    return formatCurrency(amount);
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
  };

  const closeCreateModal = () => {
    setShowCreateForm(false);
    resetForm();
  };

  const closeEditModal = () => {
    setShowEditForm(false);
    setEditingProviderId(null);
    setEditName('');
    setEditEmail('');
    setEditPhone('');
    setEditAddress('');
  };

  const handleCreateProvider = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Le nom est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      await createProvider({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });

      closeCreateModal();
      await loadFournisseurs(false);
      toast.success('Fournisseur cree.');
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = (provider: ProviderResponseDTO) => {
    Alert.alert('Supprimer fournisseur', `Supprimer ${provider.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProvider(provider.id);
            await loadFournisseurs(false);
            toast.success('Fournisseur supprime.');
          } catch (deleteError) {
            Alert.alert('Erreur', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const openEditModal = (provider: ProviderResponseDTO) => {
    setEditingProviderId(provider.id);
    setEditName(provider.name);
    setEditEmail(provider.email ?? '');
    setEditPhone(provider.phone ?? '');
    setEditAddress(provider.address ?? '');
    setShowEditForm(true);
  };

  const handleUpdateProvider = async () => {
    if (!editingProviderId) {
      return;
    }
    if (!editName.trim()) {
      Alert.alert('Validation', 'Le nom est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      await updateProvider(editingProviderId, {
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        address: editAddress.trim() || undefined,
      });

      closeEditModal();
      await loadFournisseurs(false);
      toast.success('Fournisseur mis a jour.');
    } catch (updateError) {
      Alert.alert('Erreur', getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  };

  const handleRecordSupplierPayment = async () => {
    if (!paymentProviderId) {
      return;
    }

    const amount = parseAmount(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Validation', 'Le montant du reglement doit etre superieur a 0.');
      return;
    }

    setSaving(true);
    try {
      await recordSupplierPayment(paymentProviderId, {
        amount,
        method: paymentMethod,
        reference: paymentReference.trim() || undefined,
        note: paymentNote.trim() || undefined,
      });

      closePaymentModal();
      await loadFournisseurs(false);
      toast.success('Reglement fournisseur enregistre.');
    } catch (paymentError) {
      Alert.alert('Erreur', getErrorMessage(paymentError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SkeletonList />;
  }

  if (error) {
    return <ErrorState title='Erreur fournisseurs' message={error} onRetry={() => void loadFournisseurs()} />;
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
        <ScreenHeader title='Fournisseurs' subtitle='Suivi des fournisseurs et coordonnees' />

        <SegmentedControl
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={(value) => setActiveTab(value as FournisseursTab)}
        />

        {activeTab === 'dettes' ? (
          supplierAccounts.length === 0 ? (
            <EmptyState
              icon='check-circle'
              title='Aucun compte fournisseur'
              description='Les consignations, ventes et reglements fournisseur apparaitront ici.'
            />
          ) : (
            <View style={styles.list}>
              {supplierAccounts.map((account) => {
                const expanded = expandedAccountIds.includes(account.providerId);
                return (
                  <AppCard key={account.providerId} style={styles.providerCard}>
                    <Pressable
                      style={styles.debtHeader}
                      onPress={() => toggleAccountExpansion(account.providerId)}
                    >
                      <View style={styles.debtMain}>
                        <Text style={styles.providerName}>{account.providerName || account.providerId}</Text>
                        <Text style={styles.providerMeta}>
                          {account.currentConsignedUnits} en stock sur {account.totalConsignedUnitsReceived} recu{account.totalConsignedUnitsReceived > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={styles.debtAmountWrap}>
                        <Text style={styles.debtLabel}>Solde restant</Text>
                        <Text style={styles.debtAmount}>{formatCurrency(account.balanceDue)}</Text>
                        <Feather
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={colors.neutral500}
                        />
                      </View>
                    </Pressable>

                    <View style={styles.metricsGrid}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Valeur depart</Text>
                        <Text style={styles.metricValue}>{formatCurrency(account.totalConsignedValue)}</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Vendu consigne</Text>
                        <Text style={styles.metricValue}>{account.soldConsignedUnits}</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Dette creee</Text>
                        <Text style={styles.metricValue}>{formatCurrency(account.totalDebt)}</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Deja regle</Text>
                        <Text style={styles.metricValue}>{formatCurrency(account.totalPaid)}</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Stock restant</Text>
                        <Text style={styles.metricValue}>{formatCurrency(account.stockValueRemaining)}</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Marge brute</Text>
                        <Text style={styles.metricValue}>{formatCurrency(account.grossMargin)}</Text>
                      </View>
                    </View>

                    {account.balanceDue > 0 ? (
                      <AppButton
                        label='Enregistrer un reglement'
                        variant='outline'
                        onPress={() => openPaymentModal(account)}
                      />
                    ) : null}

                    {expanded ? (
                      <View style={styles.debtLines}>
                        {account.lines.map((line, index) => (
                          <View key={line.id ?? `${account.providerId}-${line.type}-${index}`} style={styles.debtLine}>
                            <View style={styles.debtLineMain}>
                              <Text style={styles.debtLineTitle}>{LEDGER_TYPE_LABELS[line.type]}</Text>
                              <Text style={styles.providerMeta}>
                                {line.productName ? `${line.productName}${line.variantLabel ? ` - ${line.variantLabel}` : ''}` : line.note || '-'}
                              </Text>
                              <Text style={styles.providerMeta}>
                                {formatDate(line.date)} - {line.quantity} unite{line.quantity > 1 ? 's' : ''}
                                {line.providerPrice ? ` x ${formatCurrency(line.providerPrice)}` : ''}
                              </Text>
                              {line.margin ? (
                                <Text style={styles.providerMeta}>Marge: {formatCurrency(line.margin)}</Text>
                              ) : null}
                            </View>
                            <Text
                              style={[
                                styles.debtLineAmount,
                                line.type === 'SUPPLIER_PAYMENT' && styles.paymentLineAmount,
                              ]}
                            >
                              {formatLineAmount(line.type, line.amount)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </AppCard>
                );
              })}
            </View>
          )
        ) : (
          <>
            <SearchField
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder='Rechercher un fournisseur...'
            />

            {filteredProviders.length === 0 ? (
              <EmptyState
                icon='truck'
                title='Aucun fournisseur'
                description='Ajoutez un fournisseur pour preparer vos approvisionnements.'
                actionLabel='Ajouter'
                onAction={() => setShowCreateForm(true)}
              />
            ) : (
              <View style={styles.list}>
                {filteredProviders.map((provider) => (
                  <AppCard key={provider.id} style={styles.providerCard}>
                    <View style={styles.providerHeader}>
                      <Text style={styles.providerName}>{provider.name}</Text>
                      <View style={styles.actionsWrap}>
                        <Pressable onPress={() => openEditModal(provider)}>
                          <Feather name='edit-2' size={18} color={colors.neutral600} />
                        </Pressable>
                        <Pressable onPress={() => handleDeleteProvider(provider)}>
                          <Feather name='trash-2' size={18} color={colors.danger600} />
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.providerMeta}>{provider.email || '-'}</Text>
                    <Text style={styles.providerMeta}>{provider.phone || '-'}</Text>
                    <Text style={styles.providerMeta}>{provider.address || '-'}</Text>
                  </AppCard>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <FloatingActionButton
        accessibilityLabel='Ajouter un fournisseur'
        onPress={() => setShowCreateForm(true)}
      />

      <FormModal
        visible={showCreateForm}
        title='Nouveau fournisseur'
        onClose={closeCreateModal}
      >
        <InputField
          label='Nom'
          value={name}
          onChangeText={setName}
          placeholder='Nom du fournisseur'
        />
        <InputField
          label='Email (optionnel)'
          value={email}
          onChangeText={setEmail}
          placeholder='contact@fournisseur.com'
          autoCapitalize='none'
          keyboardType='email-address'
        />
        <InputField
          label='Telephone (optionnel)'
          value={phone}
          onChangeText={setPhone}
          placeholder='+225000000000'
        />
        <InputField
          label='Adresse (optionnel)'
          value={address}
          onChangeText={setAddress}
          placeholder='Adresse'
        />

        <View style={styles.actionRow}>
          <View style={styles.actionItem}>
            <AppButton
              label='Retour'
              variant='outline'
              onPress={closeCreateModal}
              disabled={saving}
            />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={saving ? 'Ajout...' : 'Ajouter'}
              onPress={() => {
                void handleCreateProvider();
              }}
              disabled={saving}
            />
          </View>
        </View>
      </FormModal>

      <FormModal
        visible={showEditForm}
        title='Modifier fournisseur'
        onClose={closeEditModal}
      >
        <InputField
          label='Nom'
          value={editName}
          onChangeText={setEditName}
          placeholder='Nom du fournisseur'
        />
        <InputField
          label='Email (optionnel)'
          value={editEmail}
          onChangeText={setEditEmail}
          placeholder='contact@fournisseur.com'
          autoCapitalize='none'
          keyboardType='email-address'
        />
        <InputField
          label='Telephone (optionnel)'
          value={editPhone}
          onChangeText={setEditPhone}
          placeholder='+225000000000'
        />
        <InputField
          label='Adresse (optionnel)'
          value={editAddress}
          onChangeText={setEditAddress}
          placeholder='Adresse'
        />

        <View style={styles.actionRow}>
          <View style={styles.actionItem}>
            <AppButton
              label='Retour'
              variant='outline'
              onPress={closeEditModal}
              disabled={saving}
            />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={saving ? 'Mise a jour...' : 'Mettre a jour'}
              onPress={() => {
                void handleUpdateProvider();
              }}
              disabled={saving}
            />
          </View>
        </View>
      </FormModal>

      <FormModal
        visible={showPaymentForm}
        title='Reglement fournisseur'
        onClose={closePaymentModal}
      >
        <Text style={styles.paymentProviderName}>{paymentProviderName}</Text>
        <InputField
          label='Montant regle'
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          placeholder='0'
          keyboardType='decimal-pad'
        />
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>Moyen de paiement</Text>
          <SegmentedControl
            options={PAYMENT_METHOD_OPTIONS}
            value={paymentMethod}
            onChange={(value) => setPaymentMethod(value as PaymentMethod)}
          />
        </View>
        <InputField
          label='Reference (optionnel)'
          value={paymentReference}
          onChangeText={setPaymentReference}
          placeholder='Numero recu, transaction...'
        />
        <InputField
          label='Note (optionnel)'
          value={paymentNote}
          onChangeText={setPaymentNote}
          placeholder='Details du reglement'
          multiline
          inputStyle={styles.multilineInput}
        />

        <View style={styles.actionRow}>
          <View style={styles.actionItem}>
            <AppButton
              label='Retour'
              variant='outline'
              onPress={closePaymentModal}
              disabled={saving}
            />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={saving ? 'Enregistrement...' : 'Enregistrer'}
              onPress={() => {
                void handleRecordSupplierPayment();
              }}
              disabled={saving}
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
  list: {
    marginTop: 16,
    gap: 12,
  },
  providerCard: {
    gap: 6,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  providerName: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  providerMeta: {
    ...typography.label,
    color: colors.neutral500,
  },
  debtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  debtMain: {
    flex: 1,
    gap: 2,
  },
  debtAmountWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  debtAmount: {
    ...typography.bodyMedium,
    color: colors.danger600,
  },
  debtLabel: {
    ...typography.caption,
    color: colors.neutral500,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  metricItem: {
    width: '48%',
    padding: 10,
    backgroundColor: colors.neutral50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral200,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.neutral500,
  },
  metricValue: {
    ...typography.label,
    color: colors.neutral900,
    marginTop: 2,
  },
  debtLines: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral200,
  },
  debtLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral100,
  },
  debtLineMain: {
    flex: 1,
    gap: 2,
  },
  debtLineTitle: {
    ...typography.label,
    color: colors.neutral900,
  },
  debtLineAmount: {
    ...typography.label,
    color: colors.neutral900,
  },
  paymentLineAmount: {
    color: colors.success600,
  },
  paymentProviderName: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  formSection: {
    gap: 8,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.neutral700,
  },
  multilineInput: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionItem: {
    flex: 1,
  },
});
