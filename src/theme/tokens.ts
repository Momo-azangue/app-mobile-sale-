export const colors = {
  primary700: '#0B1220',
  primary600: '#0F172A',
  primary500: '#1E293B',
  primary200: '#BFDBFE',
  primary100: '#DBEAFE',
  primary50: '#EFF6FF',

  neutral900: '#0F172A',
  neutral800: '#1E293B',
  neutral700: '#334155',
  neutral600: '#475569',
  neutral500: '#64748B',
  neutral400: '#94A3B8',
  neutral300: '#CBD5E1',
  neutral200: '#E2E8F0',
  neutral100: '#F1F5F9',
  neutral50: '#F8FAFC',
  white: '#FFFFFF',

  success600: '#047857',
  success100: '#D1FAE5',
  warning600: '#B45309',
  warning100: '#FEF3C7',
  danger600: '#B91C1C',
  danger500: '#DC2626',
  danger100: '#FEE2E2',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const shadows = {
  sm: {
    shadowColor: colors.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: colors.neutral900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
} as const;
