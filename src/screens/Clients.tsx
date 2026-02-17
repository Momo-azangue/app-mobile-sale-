import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { createClient, deleteClient, listClients } from '../api/services';
import { getErrorMessage } from '../api/errors';
import type { ClientResponseDTO } from '../types/api';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingState } from '../components/common/LoadingState';
import { SearchField } from '../components/common/SearchField';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { AppButton } from '../components/common/AppButton';

interface ClientsScreenProps {
  refreshSignal: number;
  onClientChanged: () => void;
}

export function ClientsScreen({ refreshSignal, onClientChanged }: ClientsScreenProps) {
  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await listClients();
      setClients(fetched);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients, refreshSignal]);

  const filteredClients = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return clients.filter((client) => {
      const blob = `${client.name} ${client.email ?? ''} ${client.phone ?? ''}`.toLowerCase();
      return blob.includes(lower);
    });
  }, [clients, searchTerm]);

  const handleCreateClient = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Le nom est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      await createClient({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      setName('');
      setEmail('');
      setPhone('');

      await loadClients();
      onClientChanged();
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = (client: ClientResponseDTO) => {
    Alert.alert('Supprimer client', `Supprimer ${client.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClient(client.id);
            await loadClients();
            onClientChanged();
          } catch (deleteError) {
            Alert.alert('Erreur', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingState message='Chargement clients...' />;
  }

  if (error) {
    return <ErrorState title='Erreur clients' message={error} onRetry={() => void loadClients()} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title='Clients' subtitle='Gestion de la base clients' />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nouveau client</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder='Nom'
          placeholderTextColor={colors.neutral400}
        />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder='Email (optionnel)'
          placeholderTextColor={colors.neutral400}
          keyboardType='email-address'
          autoCapitalize='none'
        />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder='Telephone ex: +22501234567'
          placeholderTextColor={colors.neutral400}
        />

        <View style={styles.buttonWrap}>
          <AppButton
            label={saving ? 'Creation...' : 'Ajouter client'}
            onPress={() => {
              void handleCreateClient();
            }}
            disabled={saving}
          />
        </View>
      </View>

      <SearchField
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholder='Rechercher un client...'
      />

      {filteredClients.length === 0 ? (
        <EmptyState icon='users' title='Aucun client' description='Ajoutez votre premier client pour demarrer les ventes.' />
      ) : (
        <View style={styles.list}>
          {filteredClients.map((client) => (
            <View key={client.id} style={styles.clientCard}>
              <View style={styles.clientHeader}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Pressable onPress={() => handleDeleteClient(client)}>
                  <Feather name='trash-2' size={18} color={colors.danger600} />
                </Pressable>
              </View>

              <Text style={styles.clientMeta}>{client.email || '-'}</Text>
              <Text style={styles.clientMeta}>{client.phone || '-'}</Text>
            </View>
          ))}
        </View>
      )}
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
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 16,
    marginBottom: 16,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    marginBottom: 10,
    color: colors.neutral900,
  },
  input: {
    ...typography.body,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.neutral300,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  buttonWrap: {
    marginTop: 12,
  },
  list: {
    marginTop: 16,
    gap: 12,
  },
  clientCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 14,
    ...shadows.sm,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  clientMeta: {
    marginTop: 6,
    ...typography.label,
    color: colors.neutral500,
  },
});
