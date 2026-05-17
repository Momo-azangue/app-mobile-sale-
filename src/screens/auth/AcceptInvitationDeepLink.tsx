import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { acceptInvitation, validateInvitationToken } from '../../api/services';
import { getErrorMessage } from '../../api/errors';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ErrorState } from '../../components/common/ErrorState';
import { InputField } from '../../components/common/InputField';
import { LoadingState } from '../../components/common/LoadingState';
import { colors } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { getPasswordValidationMessage } from '../../utils/password';

interface AcceptInvitationDeepLinkScreenProps {
  token: string;
  onDone: () => void;
}

export function AcceptInvitationDeepLinkScreen({ token, onDone }: AcceptInvitationDeepLinkScreenProps) {
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | undefined>();
  const [role, setRole] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function validate() {
      setValidating(true);
      setValidationError(null);
      try {
        const result = await validateInvitationToken(token);
        if (!mounted) return;
        if (!result.valid) {
          setValidationError(invitationReasonLabel(result.reason));
          return;
        }
        setEmail(result.email);
        setRole(result.role);
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

  const handleAccept = async () => {
    const passwordValidationMessage = getPasswordValidationMessage(password);
    if (passwordValidationMessage) {
      Alert.alert('Validation', passwordValidationMessage);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Validation', 'Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSaving(true);
    try {
      await acceptInvitation(token, password);
      Alert.alert('Invitation acceptee', 'Votre compte est pret. Connectez-vous avec votre email.', [
        { text: 'Se connecter', onPress: onDone },
      ]);
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (validating) {
    return <LoadingState message="Verification de l'invitation..." />;
  }

  if (validationError) {
    return (
      <ErrorState
        title='Invitation invalide'
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
            <Feather name='user-plus' size={24} color={colors.primary600} />
          </View>
          <Text style={styles.title}>Accepter l'invitation</Text>
          <Text style={styles.subtitle}>Creez votre mot de passe pour rejoindre la boutique.</Text>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Email</Text>
            <Text style={styles.metaValue}>{email ?? '-'}</Text>
            <Text style={styles.metaLabel}>Role</Text>
            <Text style={styles.metaValue}>{role ?? '-'}</Text>
          </View>

          <InputField
            label='Mot de passe'
            value={password}
            onChangeText={setPassword}
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
            label="Accepter l'invitation"
            onPress={() => {
              void handleAccept();
            }}
            loading={saving}
          />
          <AppButton label='Retour connexion' variant='ghost' onPress={onDone} disabled={saving} />
        </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function invitationReasonLabel(reason?: string): string {
  switch (reason) {
    case 'EXPIRED':
      return 'Cette invitation a expire. Demandez a un administrateur de la renvoyer.';
    case 'ACCEPTED':
      return 'Cette invitation a deja ete acceptee.';
    case 'REVOKED':
      return 'Cette invitation a ete revoquee par un administrateur.';
    case 'DECLINED':
      return 'Cette invitation a ete refusee.';
    case 'MISSING':
      return "Le lien ne contient pas de token d'invitation.";
    case 'INVALID':
    default:
      return "Ce lien d'invitation est invalide.";
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
  metaBox: {
    gap: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 8,
    backgroundColor: colors.neutral50,
  },
  metaLabel: {
    ...typography.captionMedium,
    color: colors.neutral500,
    textTransform: 'uppercase',
  },
  metaValue: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
});
