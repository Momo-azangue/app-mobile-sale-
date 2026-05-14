import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface ImeiCaptureRowProps {
  index: number;
  value: string;
  onChange: (value: string) => void;
  onScan: () => void;
  error?: string;
}

export function ImeiCaptureRow({ index, value, onChange, onScan, error }: ImeiCaptureRowProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.row, error && styles.rowError]}>
        <View style={styles.inputWrap}>
          <Text style={styles.label}>IMEI {index + 1}</Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder='Scanner ou saisir'
            placeholderTextColor={colors.neutral400}
            autoCapitalize='characters'
            autoCorrect={false}
            style={styles.input}
          />
        </View>
        <Pressable style={styles.scanButton} onPress={onScan} hitSlop={8}>
          <Feather name='camera' size={18} color={colors.white} />
          <Text style={styles.scanText}>Scanner</Text>
        </Pressable>
      </View>
      <Text style={styles.manualHint}>saisie manuelle possible dans le champ</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rowError: {
    borderColor: colors.danger600,
    backgroundColor: colors.danger100,
  },
  inputWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.captionMedium,
    color: colors.neutral600,
  },
  input: {
    ...typography.body,
    color: colors.neutral900,
    paddingVertical: 4,
  },
  scanButton: {
    minHeight: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary600,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanText: {
    ...typography.label,
    color: colors.white,
  },
  manualHint: {
    ...typography.caption,
    color: colors.neutral500,
    textDecorationLine: 'underline',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger600,
  },
});
