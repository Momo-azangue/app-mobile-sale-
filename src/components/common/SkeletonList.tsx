import { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, StyleSheet, View } from 'react-native';

import { colors, radius, shadows, spacing } from '../../theme/tokens';

interface SkeletonListProps {
  count?: number;
  variant?: 'list' | 'detail';
  style?: StyleProp<ViewStyle>;
}

export function SkeletonList({ count = 6, variant = 'list', style }: SkeletonListProps) {
  const shimmer = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const Bar = ({
    width,
    height = 12,
    style: barStyle,
  }: {
    width: ViewStyle['width'];
    height?: number;
    style?: StyleProp<ViewStyle>;
  }) => (
    <Animated.View
      style={[
        styles.bar,
        { width, height, opacity: shimmer },
        barStyle,
      ]}
    />
  );

  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.card}>
          {variant === 'detail' && index === 0 ? (
            <>
              <Bar width='60%' height={20} />
              <Bar width='40%' height={12} style={styles.mt8} />
              <View style={styles.row}>
                <Bar width='30%' height={48} style={styles.block} />
                <Bar width='30%' height={48} style={styles.block} />
                <Bar width='30%' height={48} style={styles.block} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Bar width='55%' height={16} />
                <Bar width={44} height={16} />
              </View>
              <Bar width='35%' height={12} style={styles.mt8} />
              <Bar width='80%' height={12} style={styles.mt8} />
              <View style={styles.row}>
                <Bar width='45%' height={36} style={styles.block} />
                <Bar width='45%' height={36} style={styles.block} />
              </View>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: spacing.lg,
    gap: 6,
    ...shadows.sm,
  },
  bar: {
    backgroundColor: colors.neutral200,
    borderRadius: radius.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  block: {
    borderRadius: radius.md,
  },
  mt8: {
    marginTop: spacing.sm,
  },
});
