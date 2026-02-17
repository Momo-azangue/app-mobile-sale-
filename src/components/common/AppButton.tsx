import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

type AppButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: AppButtonVariant;
}

export function AppButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}: AppButtonProps) {
  const currentButtonStyle =
    variant === 'outline'
      ? styles.outlineButton
      : variant === 'ghost'
        ? styles.ghostButton
        : variant === 'danger'
          ? styles.dangerButton
          : styles.primaryButton;

  const currentTextStyle =
    variant === 'outline'
      ? styles.outlineText
      : variant === 'ghost'
        ? styles.ghostText
        : variant === 'danger'
          ? styles.dangerText
          : styles.primaryText;

  const spinnerColor =
    variant === 'outline' || variant === 'ghost'
      ? colors.primary600
      : colors.white;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.baseButton,
        currentButtonStyle,
        (disabled || loading) && styles.disabled,
        pressed && !(disabled || loading) && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size='small' color={spinnerColor} />
      ) : (
        <Text style={[styles.baseText, currentTextStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
  },
  baseText: {
    ...typography.label,
    fontFamily: typography.label.fontFamily,
  },
  primaryButton: {
    backgroundColor: colors.primary600,
    borderColor: colors.primary600,
  },
  primaryText: {
    color: colors.white,
  },
  outlineButton: {
    backgroundColor: colors.white,
    borderColor: colors.neutral300,
  },
  outlineText: {
    color: colors.neutral800,
  },
  ghostButton: {
    backgroundColor: colors.primary50,
    borderColor: colors.primary50,
  },
  ghostText: {
    color: colors.primary600,
  },
  dangerButton: {
    backgroundColor: colors.danger500,
    borderColor: colors.danger500,
  },
  dangerText: {
    color: colors.white,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.88,
  },
});
