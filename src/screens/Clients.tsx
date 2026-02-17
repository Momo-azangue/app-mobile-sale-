import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { createClient, deleteClient, listClients } from '../api/services';
import { getErrorMessage } from '../api/errors';
import type { ClientResponseDTO } from '../types/api';

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Clients</Text>
        <Text style={styles.subtitle}>CRUD API: GET/POST/DELETE /clients</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nouveau client</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder='Nom'
          placeholderTextColor='#9CA3AF'
        />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder='Email (optionnel)'
          placeholderTextColor='#9CA3AF'
          keyboardType='email-address'
          autoCapitalize='none'
        />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder='Telephone ex: +22501234567'
          placeholderTextColor='#9CA3AF'
        />

        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleCreateClient}
          disabled={saving}
        >
          <Text style={styles.buttonText}>{saving ? 'Creation...' : 'Ajouter client'}</Text>
        </Pressable>
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

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color='#4338CA' />
          <Text style={styles.centeredText}>Chargement clients...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Erreur clients</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadClients()}>
            <Text style={styles.retryText}>Reessayer</Text>
          </Pressable>
        </View>
      ) : filteredClients.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>Aucun client</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredClients.map((client) => (
            <View key={client.id} style={styles.clientCard}>
              <View style={styles.clientHeader}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Pressable onPress={() => handleDeleteClient(client)}>
                  <Feather name='trash-2' size={18} color='#B91C1C' />
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
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 96,
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    color: '#111827',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  button: {
    marginTop: 12,
    backgroundColor: '#4338CA',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchBox: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  clientMeta: {
    marginTop: 6,
    color: '#6B7280',
  },
});
