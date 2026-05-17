import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, shadows, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { getTabLabel, type NavigationTab } from '../navigation/tabs';

interface MobileTopBarProps {
  activeTab: NavigationTab;
  onOpenDrawer: () => void;
}

export function MobileTopBar({ activeTab, onOpenDrawer }: MobileTopBarProps) {
  const activeLabel = getTabLabel(activeTab);

  return (
    <View style={styles.container}>
      <Pressable style={styles.menuButton} onPress={onOpenDrawer}>
        <Feather name='menu' size={18} color={colors.neutral800} />
      </Pressable>

      <View style={styles.rightBlock}>
        <View style={styles.textWrap}>
          <Text style={styles.brand}>Sales App</Text>
          <Text style={styles.subtitle}>{activeLabel}</Text>
        </View>
        <View style={styles.avatarWrap}>
          <Image source={require('../../assets/icon.png')} style={styles.avatar} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral200,
    ...shadows.sm,
  
  },
  rightBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    justifyContent: 'flex-end',
  },
  textWrap: {
    alignItems: 'flex-end',
  },
  avatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.neutral200,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  brand: {
    ...typography.label,
    color: colors.neutral900,
  },
  subtitle: {
    ...typography.caption,
    color: colors.neutral500,
    textAlign: 'right',
  },
  menuButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral100,
  },
});
