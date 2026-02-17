import { ComponentProps } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const TABS: Array<{ id: string; label: string; icon: ComponentProps<typeof Feather>['name'] }> = [
  { id: 'dashboard', label: 'Tableau', icon: 'home' },
  { id: 'ventes', label: 'Ventes', icon: 'shopping-cart' },
  { id: 'stocks', label: 'Stocks', icon: 'package' },
  { id: 'clients', label: 'Clients', icon: 'users' },
  { id: 'parametres', label: 'Reglages', icon: 'settings' },
];

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
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
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  tabActive: {
    backgroundColor: '#EEF2FF',
  },
  tabPressed: {
    backgroundColor: '#F3F4F6',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeColor: {
    color: '#4338CA',
  },
  inactiveColor: {
    color: '#6B7280',
  },
});
