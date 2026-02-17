import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../theme/tokens';
import { typography } from '../../../theme/typography';

export function DesktopPromoPanel() {
  return (
    <View style={styles.leftPanel}>
      <Text style={styles.brand}>Sales App</Text>
      <Text style={styles.heroTitle}>Pilotez vos ventes et votre stock en temps reel.</Text>
      <Text style={styles.heroText}>
        Connectez-vous pour gerer clients, ventes, factures et mouvements de stock depuis le mobile.
      </Text>

      <View style={styles.pointList}>
        <Text style={styles.point}>- Auth securisee par token et tenant.</Text>
        <Text style={styles.point}>- Creation de ventes avec lignes produits.</Text>
        <Text style={styles.point}>- Suivi des factures payees / impayees / partielles.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leftPanel: {
    flex: 1,
    backgroundColor: colors.primary700,
    paddingHorizontal: 28,
    paddingVertical: 34,
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.white,
    ...typography.bodyMedium,
  },
  heroTitle: {
    marginTop: 24,
    color: colors.white,
    ...typography.display,
  },
  heroText: {
    marginTop: 12,
    color: colors.primary100,
    ...typography.label,
  },
  pointList: {
    marginTop: 24,
    gap: 10,
  },
  point: {
    ...typography.label,
    color: colors.primary100,
  },
});
