import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

export function ScreenHeader({ title, subtitle, rightSlot }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.h1,
    color: colors.neutral900,
  },
  subtitle: {
    ...typography.label,
    color: colors.neutral500,
    marginTop: 2,
  },
  rightSlot: {
    alignSelf: 'center',
  },
});
