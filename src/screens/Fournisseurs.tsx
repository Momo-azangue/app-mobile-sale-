import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { createProvider, deleteProvider, listProviders, updateProvider } from '../api/services';
import { getErrorMessage } from '../api/errors';
import type { ProviderResponseDTO } from '../types/api';
import { colors } from '../theme/tokens';
import { typography } from '../theme/typography';
import { AppButton } from '../components/common/AppButton';
import { AppCard } from '../components/common/AppCard';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { FloatingActionButton } from '../components/common/FloatingActionButton';
import { FormModal } from '../components/common/FormModal';
import { InputField } from '../components/common/InputField';
import { LoadingState } from '../components/common/LoadingState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SearchField } from '../components/common/SearchField';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface FournisseursScreenProps {
  refreshSignal: number;
}

export function FournisseursScreen({ refreshSignal }: FournisseursScreenProps) {
  const [providers, setProviders] = useState<ProviderResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const loadProviders = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);
    try {
      const fetched = await listProviders();
      setProviders(fetched);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders(true);
  }, [loadProviders, refreshSignal]);
  const { refreshing, onRefresh } = usePullToRefresh(() => loadProviders(false));

  const filteredProviders = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return providers.filter((provider) => {
      const blob = `${provider.name} ${provider.email ?? ''} ${provider.phone ?? ''} ${provider.address ?? ''}`.toLowerCase();
      return blob.includes(lower);
    });
  }, [providers, searchTerm]);

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
      await loadProviders();
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
            await loadProviders();
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
      await loadProviders();
    } catch (updateError) {
      Alert.alert('Erreur', getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message='Chargement fournisseurs...' />;
  }

  if (error) {
    return <ErrorState title='Erreur fournisseurs' message={error} onRetry={() => void loadProviders()} />;
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionItem: {
    flex: 1,
  },
});
