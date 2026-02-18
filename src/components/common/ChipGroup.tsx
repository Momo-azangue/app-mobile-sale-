import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

export interface ChipOption {
  label: string;
  value: string;
}

interface ChipGroupProps {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  layout?: 'wrap' | 'row-scroll';
  tone?: 'soft' | 'solid';
  style?: StyleProp<ViewStyle>;
}

export function ChipGroup({
  options,
  value,
  onChange,
  layout = 'wrap',
  tone = 'soft',
  style,
}: ChipGroupProps) {
  if (layout === 'row-scroll') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.rowScrollContent, style]}
      >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              style={[
                styles.chip,
                styles.chipRowScroll,
                active && (tone === 'solid' ? styles.chipSolidActive : styles.chipSoftActive),
              ]}
              onPress={() => onChange(option.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  active && (tone === 'solid' ? styles.chipSolidTextActive : styles.chipSoftTextActive),
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            style={[
              styles.chip,
              styles.chipWrap,
              active && (tone === 'solid' ? styles.chipSolidActive : styles.chipSoftActive),
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text
              style={[
                styles.chipText,
                active && (tone === 'solid' ? styles.chipSolidTextActive : styles.chipSoftTextActive),
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rowScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.neutral300,
    backgroundColor: colors.white,
  },
  chipWrap: {
    marginRight: 8,
    marginBottom: 8,
  },
  chipRowScroll: {
    marginRight: 8,
  },
  chipSoftActive: {
    borderColor: colors.primary200,
    backgroundColor: colors.primary50,
  },
  chipSolidActive: {
    borderColor: colors.primary600,
    backgroundColor: colors.primary600,
  },
  chipText: {
    ...typography.label,
    color: colors.neutral600,
  },
  chipSoftTextActive: {
    color: colors.primary600,
    fontFamily: typography.label.fontFamily,
  },
  chipSolidTextActive: {
    color: colors.white,
    fontFamily: typography.label.fontFamily,
  },
});
