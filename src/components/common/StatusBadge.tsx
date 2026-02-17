import { StyleSheet, Text, View } from 'react-native';

import type { InvoiceStatus } from '../../types/api';
import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface StatusBadgeProps {
  status: InvoiceStatus;
}

const statusMeta: Record<InvoiceStatus, { label: string; text: string; bg: string; border: string }> = {
  PAYE: { label: 'Payee', text: colors.success600, bg: colors.success100, border: '#A7F3D0' },
  IMPAYE: { label: 'Impayee', text: colors.danger600, bg: colors.danger100, border: '#FCA5A5' },
  PARTIEL: { label: 'Partiel', text: colors.warning600, bg: colors.warning100, border: '#FCD34D' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = statusMeta[status];

  return (
    <View style={[styles.badge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
      <Text style={[styles.label, { color: meta.text }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.captionMedium,
  },
});
