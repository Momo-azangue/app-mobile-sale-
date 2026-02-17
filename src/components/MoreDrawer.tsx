import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { SECONDARY_TABS, type NavigationTab } from '../navigation/tabs';

interface MoreDrawerProps {
  visible: boolean;
  activeTab: NavigationTab;
  onClose: () => void;
  onSelectTab: (tab: NavigationTab) => void;
  onLogout: () => void;
}

export function MoreDrawer({
  visible,
  activeTab,
  onClose,
  onSelectTab,
  onLogout,
}: MoreDrawerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View
          style={[
            styles.panel,
            {
              paddingTop: Math.max(20, insets.top + 8),
              paddingBottom: Math.max(24, insets.bottom + 12),
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Plus</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Feather name='x' size={18} color={colors.neutral700} />
            </Pressable>
          </View>

          <View style={styles.list}>
            {SECONDARY_TABS.map((item) => {
              const isActive = item.id === activeTab;
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.item,
                    isActive && styles.itemActive,
                    pressed && !isActive && styles.itemPressed,
                  ]}
                  onPress={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                >
                  <Feather
                    name={item.icon}
                    size={18}
                    color={isActive ? colors.primary600 : colors.neutral500}
                  />
                  <Text style={[styles.itemText, isActive && styles.itemTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.logout} onPress={onLogout}>
            <Feather name='log-out' size={18} color={colors.danger500} />
            <Text style={styles.logoutText}>Deconnexion</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  panel: {
    width: '100%',
    maxWidth: '100%',
    height: '100%',
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  title: {
    ...typography.h2,
    color: colors.neutral900,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral100,
  },
  list: {
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
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.neutral200,
    paddingHorizontal: 10,
    paddingTop: 14,
    marginTop: 8,
  },
  logoutText: {
    ...typography.label,
    color: colors.danger500,
  },
});
