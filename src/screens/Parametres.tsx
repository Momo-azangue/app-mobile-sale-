import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { createCommerceSettings, listCommerceSettings } from '../api/services';
import { getErrorMessage } from '../api/errors';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { AppButton } from '../components/common/AppButton';

interface ParametresScreenProps {
  refreshSignal: number;
  onSettingsChanged: () => void;
  onLogout: () => Promise<void>;
}

export function ParametresScreen({
  refreshSignal,
  onSettingsChanged,
  onLogout,
}: ParametresScreenProps) {
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
    return <LoadingState message='Chargement parametres...' />;
  }

  if (error) {
    return <ErrorState title='Erreur parametres' message={error} onRetry={() => void loadSettings()} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title='Parametres' subtitle='Configuration boutique et session' />

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Feather name='shopping-bag' size={18} color={colors.primary600} />
          <Text style={styles.sectionTitle}>Boutique</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nom de la boutique</Text>
          <TextInput value={storeName} onChangeText={setStoreName} style={styles.input} />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Devise</Text>
          <TextInput
            value={currency}
            onChangeText={setCurrency}
            style={styles.input}
            autoCapitalize='characters'
            maxLength={3}
          />
        </View>

        <Text style={styles.note}>
          Champs non supportes par l API actuelle masques pour le MVP: adresse, email boutique, notifications.
        </Text>

        <AppButton
          label={saving ? 'Sauvegarde...' : 'Sauvegarder'}
          onPress={() => {
            void handleSave();
          }}
          disabled={saving}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Feather name='shield' size={18} color={colors.primary600} />
          <Text style={styles.sectionTitle}>Session</Text>
        </View>

        <AppButton label='Deconnexion' variant='danger' onPress={handleLogout} />
      </View>
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
    gap: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 16,
    gap: 14,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    ...typography.label,
    color: colors.neutral600,
  },
  input: {
    ...typography.body,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral300,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.neutral900,
  },
  note: {
    ...typography.caption,
    color: colors.neutral500,
  },
});
