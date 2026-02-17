import { StyleSheet, Text } from 'react-native';

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
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

export function LoginFormSection({
  email,
  password,
  isLoading,
  canSubmit,
  error,
  onEmailChange,
  onPasswordChange,
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

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
  error: {
    ...typography.label,
    color: colors.danger600,
  },
});
