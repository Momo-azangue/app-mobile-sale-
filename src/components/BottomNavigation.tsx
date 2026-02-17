import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { MOBILE_PRIMARY_TABS, type NavigationTab } from '../navigation/tabs';

const PRIMARY_ITEMS: Array<{ id: NavigationTab; label: string; icon: ComponentProps<typeof Feather>['name'] }> =
  MOBILE_PRIMARY_TABS.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon }));

interface BottomNavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <View style={styles.container}>
      {PRIMARY_ITEMS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            style={({ pressed }) => [
              styles.tab,
              isActive && styles.tabActive,
              pressed && !isActive && styles.tabPressed,
            ]}
            onPress={() => onTabChange(tab.id)}
          >
            <Feather
              name={tab.icon}
              size={20}
              color={isActive ? styles.activeColor.color : styles.inactiveColor.color}
            />
            <Text style={[styles.label, isActive ? styles.activeColor : styles.inactiveColor]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.neutral200,
    backgroundColor: colors.white,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.primary50,
  },
  tabPressed: {
    backgroundColor: colors.neutral100,
  },
  label: {
    ...typography.caption,
  },
  activeColor: {
    color: colors.primary600,
  },
  inactiveColor: {
    color: colors.neutral500,
  },
});
