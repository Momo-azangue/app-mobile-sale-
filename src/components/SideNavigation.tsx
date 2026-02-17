import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';

export type NavigationTab = 'dashboard' | 'ventes' | 'stocks' | 'clients' | 'parametres';

const DESKTOP_TABS: Array<{ id: NavigationTab; label: string; icon: ComponentProps<typeof Feather>['name'] }> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'ventes', label: 'Ventes', icon: 'shopping-cart' },
  { id: 'stocks', label: 'Stocks', icon: 'package' },
  { id: 'clients', label: 'Clients', icon: 'users' },
  { id: 'parametres', label: 'Parametres', icon: 'settings' },
];

interface SideNavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onLogout: () => void;
}

export function SideNavigation({ activeTab, onTabChange, onLogout }: SideNavigationProps) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.logoWrap}>
        <Text style={styles.logo}>Sales App</Text>
      </View>

      <View style={styles.nav}>
        {DESKTOP_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={({ pressed }) => [
                styles.item,
                isActive && styles.itemActive,
                pressed && !isActive && styles.itemPressed,
              ]}
              onPress={() => onTabChange(tab.id)}
            >
              <Feather name={tab.icon} size={18} color={isActive ? colors.primary600 : colors.neutral500} />
              <Text style={[styles.itemText, isActive && styles.itemTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Feather name='log-out' size={18} color={colors.neutral700} />
        <Text style={styles.logoutText}>Deconnexion</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    borderRightWidth: 1,
    borderRightColor: colors.neutral200,
    backgroundColor: colors.white,
    paddingVertical: 20,
    paddingHorizontal: 12,
    ...shadows.sm,
  },
  logoWrap: {
    paddingHorizontal: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral200,
  },
  logo: {
    ...typography.h2,
    color: colors.primary600,
  },
  nav: {
    marginTop: 16,
    flex: 1,
    gap: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: colors.primary50,
  },
  itemPressed: {
    backgroundColor: colors.neutral100,
  },
  itemText: {
    ...typography.label,
    color: colors.neutral700,
  },
  itemTextActive: {
    color: colors.primary600,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral200,
    backgroundColor: colors.neutral50,
  },
  logoutText: {
    ...typography.label,
    color: colors.neutral700,
  },
});
