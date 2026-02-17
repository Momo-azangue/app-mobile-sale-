import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows } from '../../theme/tokens';
import { typography } from '../../theme/typography';

export interface SegmentedOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.neutral100,
    borderRadius: radius.pill,
    padding: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingVertical: 8,
  },
  itemActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  itemLabel: {
    ...typography.label,
    color: colors.neutral600,
  },
  itemLabelActive: {
    color: colors.primary600,
  },
});
