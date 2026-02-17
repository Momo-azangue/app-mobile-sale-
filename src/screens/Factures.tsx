import { ScrollView, StyleSheet, Text } from 'react-native';

import { ScreenHeader } from '../components/common/ScreenHeader';
import { AppCard } from '../components/common/AppCard';
import { colors } from '../theme/tokens';
import { typography } from '../theme/typography';

interface FacturesScreenProps {
  refreshSignal: number;
}

export function FacturesScreen({ refreshSignal }: FacturesScreenProps) {
  void refreshSignal;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title='Factures' subtitle='Paiements et PDF (module en cours)' />
      <AppCard>
        <Text style={styles.text}>
          Module prevu pour `/api/v1/invoices` (liste, paiement, generation et telechargement PDF).
        </Text>
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 96,
  },
  text: {
    ...typography.label,
    color: colors.neutral700,
  },
});
