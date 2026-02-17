import { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { AppButton } from './AppButton';

interface EmptyStateProps {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={24} color={colors.neutral500} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={styles.actionWrap}>
          <AppButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  iconWrap: {
    borderRadius: radius.pill,
    backgroundColor: colors.neutral100,
    padding: 12,
  },
  title: {
    ...typography.h2,
    color: colors.neutral900,
  },
  description: {
    ...typography.label,
    color: colors.neutral600,
    textAlign: 'center',
    maxWidth: 320,
  },
  actionWrap: {
    marginTop: 10,
  },
});
