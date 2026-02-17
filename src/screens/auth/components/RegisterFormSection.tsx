import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../theme/tokens';
import { typography } from '../../../theme/typography';
import { AppButton } from '../../../components/common/AppButton';
import { ChipGroup, type ChipOption } from '../../../components/common/ChipGroup';
import { InputField } from '../../../components/common/InputField';

interface RegisterFormSectionProps {
  registerName: string;
  registerEmail: string;
  registerPassword: string;
  storeName: string;
  plansLoading: boolean;
  planOptions: ChipOption[];
  selectedPlanId: string;
  isLoading: boolean;
  canSubmit: boolean;
  error: string | null;
  onRegisterNameChange: (value: string) => void;
  onRegisterEmailChange: (value: string) => void;
  onRegisterPasswordChange: (value: string) => void;
  onStoreNameChange: (value: string) => void;
  onPlanSelect: (value: string) => void;
  onSubmit: () => void;
}

export function RegisterFormSection({
  registerName,
  registerEmail,
  registerPassword,
  storeName,
  plansLoading,
  planOptions,
  selectedPlanId,
  isLoading,
  canSubmit,
  error,
  onRegisterNameChange,
  onRegisterEmailChange,
  onRegisterPasswordChange,
  onStoreNameChange,
  onPlanSelect,
  onSubmit,
}: RegisterFormSectionProps) {
  return (
    <>
      <InputField
        label='Nom complet'
        value={registerName}
        onChangeText={onRegisterNameChange}
        placeholder='Jean Dupont'
      />

      <InputField
        label='Email'
        value={registerEmail}
        onChangeText={onRegisterEmailChange}
        autoCapitalize='none'
        keyboardType='email-address'
        placeholder='admin@boutique.com'
      />

      <InputField
        label='Mot de passe (min 8)'
        value={registerPassword}
        onChangeText={onRegisterPasswordChange}
        secureTextEntry
        placeholder='********'
      />

      <InputField
        label='Nom boutique'
        value={storeName}
        onChangeText={onStoreNameChange}
        placeholder='Ma Boutique'
      />

      <View style={styles.planSection}>
        <Text style={styles.label}>Plan</Text>
        {plansLoading ? (
          <Text style={styles.planHint}>Chargement des plans...</Text>
        ) : planOptions.length > 0 ? (
          <ChipGroup
            options={planOptions}
            value={selectedPlanId}
            onChange={onPlanSelect}
            layout='wrap'
            tone='soft'
          />
        ) : (
          <Text style={styles.planHint}>Aucun plan recu, fallback automatique sur `basic`.</Text>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <AppButton
        label='Creer mon compte'
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={isLoading}
      />
    </>
  );
}

const styles = StyleSheet.create({
  planSection: {
    gap: 8,
  },
  label: {
    ...typography.label,
    color: colors.neutral700,
  },
  planHint: {
    ...typography.caption,
    color: colors.neutral500,
  },
  error: {
    ...typography.label,
    color: colors.danger600,
  },
});
