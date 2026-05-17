import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';

export interface SalesHistogramBucket {
  key: string;
  label: string;
  total: number;
  count: number;
}

interface SalesHistogramProps {
  buckets: SalesHistogramBucket[];
  formatCurrency: (value: number) => string;
}

const MAX_BAR_HEIGHT = 120;
const MIN_BAR_HEIGHT = 8;

export function SalesHistogram({ buckets, formatCurrency }: SalesHistogramProps) {
  const maxTotal = Math.max(...buckets.map((bucket) => bucket.total), 0);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {buckets.map((bucket) => {
          const ratio = maxTotal > 0 ? bucket.total / maxTotal : 0;
          const height = bucket.total > 0
            ? Math.max(MIN_BAR_HEIGHT, Math.round(ratio * MAX_BAR_HEIGHT))
            : MIN_BAR_HEIGHT;

          return (
            <View key={bucket.key} style={styles.bucket}>
              <Text style={styles.amount} numberOfLines={1}>
                {bucket.total > 0 ? formatCurrency(bucket.total) : '-'}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: bucket.total > 0 ? colors.primary600 : colors.neutral200,
                    },
                  ]}
                />
              </View>
              <Text style={styles.count}>{bucket.count}</Text>
              <Text style={styles.label}>{bucket.label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  bucket: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  amount: {
    ...typography.caption,
    color: colors.neutral500,
    maxWidth: 58,
  },
  barTrack: {
    width: 34,
    height: MAX_BAR_HEIGHT,
    borderRadius: radius.sm,
    backgroundColor: colors.neutral100,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  count: {
    ...typography.captionMedium,
    color: colors.neutral700,
    marginTop: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.neutral500,
    marginTop: 2,
  },
});
