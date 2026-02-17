import { useCallback, useEffect, useState } from 'react';
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

import { createCommerceSettings, listCommerceSettings } from '../api/services';
import { getErrorMessage } from '../api/errors';

interface ParametresScreenProps {
  refreshSignal: number;
  onSettingsChanged: () => void;
  onLogout: () => Promise<void>;
}

export function ParametresScreen({ refreshSignal, onSettingsChanged, onLogout }: ParametresScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [storeName, setStoreName] = useState('');
  const [currency, setCurrency] = useState('EUR');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const settings = await listCommerceSettings();
      if (settings.length > 0) {
        const latest = settings[settings.length - 1];
        setStoreName(latest.nom);
        setCurrency(latest.devise);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings, refreshSignal]);

  const handleSave = async () => {
    if (!storeName.trim()) {
      Alert.alert('Validation', 'Le nom de boutique est obligatoire.');
      return;
    }

    if (currency.trim().length !== 3) {
      Alert.alert('Validation', 'La devise doit contenir 3 caracteres (EUR, XAF, USD).');
      return;
    }

    setSaving(true);
    try {
      await createCommerceSettings({
        nom: storeName.trim(),
        devise: currency.trim().toUpperCase(),
        facturePDFActive: true,
      });

      Alert.alert('Succes', 'Parametres enregistres.');
      onSettingsChanged();
      await loadSettings();
    } catch (saveError) {
      Alert.alert('Erreur sauvegarde', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Deconnexion', 'Voulez-vous vous deconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se deconnecter',
        style: 'destructive',
        onPress: () => {
          void onLogout();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color='#4338CA' />
        <Text style={styles.centeredText}>Chargement parametres...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Erreur parametres</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => void loadSettings()}>
          <Text style={styles.retryText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Parametres</Text>
        <Text style={styles.subtitle}>GET/POST /commerce-settings</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Feather name='shopping-bag' size={18} color='#4338CA' />
          <Text style={styles.sectionTitle}>Boutique (MVP)</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nom de la boutique</Text>
          <TextInput value={storeName} onChangeText={setStoreName} style={styles.input} />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Devise</Text>
          <TextInput value={currency} onChangeText={setCurrency} style={styles.input} autoCapitalize='characters' />
        </View>

        <Text style={styles.note}>
          Champs non supportes par l'API actuelle masques temporairement: adresse, email, notifications.
        </Text>

        <Pressable style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.primaryButtonLabel}>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Feather name='shield' size={18} color='#4338CA' />
          <Text style={styles.sectionTitle}>Session</Text>
        </View>

        <Pressable style={styles.logoutRow} onPress={handleLogout}>
          <Feather name='log-out' size={18} color='#DC2626' />
          <Text style={styles.logoutText}>Deconnexion</Text>
        </Pressable>
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
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
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
    color: '#B91C1C',
    fontWeight: '700',
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  note: {
    fontSize: 12,
    color: '#6B7280',
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: '#4338CA',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '700',
  },
});
