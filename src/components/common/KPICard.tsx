import { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, shadows } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ComponentProps<typeof Feather>['name'];
  trend?: {
    value: string;
    positive: boolean;
  };
}

export function KPICard({ title, value, icon, trend }: KPICardProps) {
  const trendPrefix = trend ? (trend.positive ? '+' : '-') : '';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.value}>{value}</Text>
          {trend ? (
            <Text style={[styles.trend, { color: trend.positive ? colors.success600 : colors.danger600 }]}>
              {trendPrefix} {trend.value}
            </Text>
          ) : null}
        </View>

        <View style={styles.iconWrap}>
          <Feather name={icon} size={16} color={colors.primary600} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 14,
    minHeight: 106,
    ...shadows.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textWrap: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    ...typography.caption,
    color: colors.neutral600,
  },
  value: {
    marginTop: 6,
    ...typography.h2,
    color: colors.neutral900,
  },
  trend: {
    marginTop: 4,
    ...typography.captionMedium,
  },
  iconWrap: {
    backgroundColor: colors.primary50,
    borderRadius: radius.pill,
    padding: 8,
  },
});
