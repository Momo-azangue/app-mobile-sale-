import type { ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, shadows } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  style?: ComponentProps<typeof View>['style'];
}

export function SearchField({ value, onChangeText, placeholder, style }: SearchFieldProps) {
  return (
    <View style={[styles.container, style]}>
      <Feather name='search' size={18} color={colors.neutral400} style={styles.icon} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.neutral400}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    ...shadows.sm,
  },
  icon: {
    position: 'absolute',
    left: 14,
    top: 13,
    zIndex: 1,
  },
  input: {
    ...typography.body,
    color: colors.neutral900,
    paddingVertical: 10,
    paddingLeft: 44,
    paddingRight: 16,
  },
});
