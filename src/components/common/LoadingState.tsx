import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Chargement...' }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary600} />
      <Text style={styles.text}>{message}</Text>
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
  text: {
    ...typography.label,
    color: colors.neutral500,
  },
});
