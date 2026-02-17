import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { AppButton } from './AppButton';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Une erreur est survenue',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather name='alert-circle' size={24} color={colors.danger500} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <View style={styles.actionWrap}>
          <AppButton label='Reessayer' variant='ghost' onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.neutral50,
  },
  iconWrap: {
    borderRadius: radius.pill,
    backgroundColor: colors.danger100,
    padding: 12,
  },
  title: {
    ...typography.h2,
    color: colors.neutral900,
  },
  message: {
    ...typography.label,
    color: colors.neutral600,
    textAlign: 'center',
  },
  actionWrap: {
    marginTop: 8,
  },
});
