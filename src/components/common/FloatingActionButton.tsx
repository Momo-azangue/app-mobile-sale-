import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, shadows } from '../../theme/tokens';

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: ComponentProps<typeof Feather>['name'];
  accessibilityLabel?: string;
}

export function FloatingActionButton({
  onPress,
  icon = 'plus',
  accessibilityLabel = 'Action',
}: FloatingActionButtonProps) {
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Feather name={icon} size={24} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 36,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary600,
    ...shadows.md,
  },
  pressed: {
    opacity: 0.88,
  },
});
