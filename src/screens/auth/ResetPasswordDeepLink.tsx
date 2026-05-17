import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { getErrorMessage } from '../../api/errors';
import { resetPassword, validateResetPasswordToken } from '../../api/services';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ErrorState } from '../../components/common/ErrorState';
import { InputField } from '../../components/common/InputField';
import { LoadingState } from '../../components/common/LoadingState';
import { colors } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { getPasswordValidationMessage } from '../../utils/password';

interface ResetPasswordDeepLinkScreenProps {
  token: string;
  onDone: () => void;
}

export function ResetPasswordDeepLinkScreen({ token, onDone }: ResetPasswordDeepLinkScreenProps) {
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function validate() {
      setValidating(true);
      setValidationError(null);
      try {
        const result = await validateResetPasswordToken(token);
        if (!mounted) return;
        if (!result.valid) {
          setValidationError(tokenReasonLabel(result.reason));
        }
      } catch (error) {
        if (mounted) {
          setValidationError(getErrorMessage(error));
        }
      } finally {
        if (mounted) {
          setValidating(false);
        }
      }
    }
    void validate();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleSubmit = async () => {
    const passwordValidationMessage = getPasswordValidationMessage(newPassword);
    if (passwordValidationMessage) {
      Alert.alert('Validation', passwordValidationMessage);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation', 'Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSaving(true);
    try {
      await resetPassword({ token, newPassword });
      Alert.alert('Mot de passe modifie', 'Vous pouvez maintenant vous connecter avec le nouveau mot de passe.', [
        { text: 'Se connecter', onPress: onDone },
      ]);
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (validating) {
    return <LoadingState message='Verification du lien...' />;
  }

  if (validationError) {
    return (
      <ErrorState
        title='Lien invalide'
        message={validationError}
        actionLabel='Retour connexion'
        onRetry={onDone}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
        <AppCard style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name='lock' size={24} color={colors.primary600} />
          </View>
          <Text style={styles.title}>Nouveau mot de passe</Text>
          <Text style={styles.subtitle}>Definissez un mot de passe pour recuperer l'acces au compte.</Text>

          <InputField
            label='Nouveau mot de passe'
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            textContentType='newPassword'
            autoCapitalize='none'
          />
          <InputField
            label='Confirmer le mot de passe'
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType='newPassword'
            autoCapitalize='none'
          />

          <AppButton
            label='Enregistrer'
            onPress={() => {
              void handleSubmit();
            }}
            loading={saving}
          />
          <AppButton label='Retour connexion' variant='ghost' onPress={onDone} disabled={saving} />
        </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function tokenReasonLabel(reason?: string): string {
  switch (reason) {
    case 'EXPIRED':
      return 'Ce lien a expire. Demandez un nouvel email de reinitialisation.';
    case 'MISSING':
      return 'Le lien ne contient pas de token.';
    case 'INVALID':
    default:
      return 'Ce lien de reinitialisation est invalide.';
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary50,
  },
  title: {
    ...typography.h2,
    color: colors.neutral900,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral600,
  },
});
