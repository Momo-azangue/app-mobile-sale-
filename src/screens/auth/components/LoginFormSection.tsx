import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../theme/tokens';
import { typography } from '../../../theme/typography';
import { AppButton } from '../../../components/common/AppButton';
import { InputField } from '../../../components/common/InputField';

interface LoginFormSectionProps {
  email: string;
  password: string;
  isLoading: boolean;
  canSubmit: boolean;
  error: string | null;
  notice?: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onForgotPassword: () => void;
  onSubmit: () => void;
}

export function LoginFormSection({
  email,
  password,
  isLoading,
  canSubmit,
  error,
  notice,
  onEmailChange,
  onPasswordChange,
  onForgotPassword,
  onSubmit,
}: LoginFormSectionProps) {
  return (
    <>
      <InputField
        label='Email'
        value={email}
        onChangeText={onEmailChange}
        autoCapitalize='none'
        keyboardType='email-address'
        placeholder='admin@boutique.com'
      />

      <InputField
        label='Mot de passe'
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
        placeholder='********'
      />

      <View style={styles.secondaryActionRow}>
        <Pressable onPress={onForgotPassword} hitSlop={8}>
          <Text style={styles.secondaryActionText}>Mot de passe oublie ?</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <AppButton
        label='Se connecter'
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={isLoading}
      />
    </>
  );
}

const styles = StyleSheet.create({
  secondaryActionRow: {
    alignItems: 'flex-end',
    marginTop: -2,
  },
  secondaryActionText: {
    ...typography.label,
    color: colors.primary600,
  },
  error: {
    ...typography.label,
    color: colors.danger600,
  },
  notice: {
    ...typography.label,
    color: colors.neutral600,
  },
});
