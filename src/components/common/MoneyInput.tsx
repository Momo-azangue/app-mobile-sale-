import { useMemo } from 'react';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppSettings } from '../../context/AppSettingsContext';
import { formatCurrency } from '../../utils/format';
import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface MoneyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  allowDecimals?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  showPreview?: boolean;
}

const ZERO_DECIMAL_CURRENCIES = new Set(['XAF', 'XOF']);

function currencyLabel(currency: string): string {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 'FCFA' : currency.toUpperCase();
}

function groupDigits(value: string): string {
  if (!value) {
    return '';
  }
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function sanitizeMoneyInput(text: string, allowDecimals: boolean): string {
  const cleaned = text
    .replace(/\s/g, '')
    .replace(/[^\d.,]/g, '')
    .replace(',', '.');

  if (!allowDecimals) {
    return cleaned.replace(/\D/g, '');
  }

  const [integer = '', ...decimalParts] = cleaned.split('.');
  const decimal = decimalParts.join('').replace(/\D/g, '').slice(0, 2);
  const normalizedInteger = integer.replace(/\D/g, '');
  return decimalParts.length > 0 ? `${normalizedInteger}.${decimal}` : normalizedInteger;
}

function formatInputValue(value: string, allowDecimals: boolean): string {
  const normalized = sanitizeMoneyInput(value, allowDecimals);
  if (!normalized) {
    return '';
  }

  if (!allowDecimals) {
    return groupDigits(normalized);
  }

  const [integer = '', decimal] = normalized.split('.');
  const formattedInteger = groupDigits(integer);
  return decimal !== undefined ? `${formattedInteger},${decimal}` : formattedInteger;
}

function toNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function MoneyInput({
  label,
  value,
  onChangeText,
  allowDecimals,
  containerStyle,
  inputStyle,
  showPreview = false,
  placeholderTextColor = colors.neutral400,
  ...inputProps
}: MoneyInputProps) {
  const { currency } = useAppSettings();
  const decimalsEnabled = allowDecimals ?? !ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
  const displayValue = useMemo(
    () => formatInputValue(value, decimalsEnabled),
    [decimalsEnabled, value],
  );
  const numericValue = useMemo(() => toNumber(value), [value]);

  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, styles.inputWithSuffix, inputStyle]}
          value={displayValue}
          onChangeText={(nextValue) => onChangeText(sanitizeMoneyInput(nextValue, decimalsEnabled))}
          keyboardType={decimalsEnabled ? 'decimal-pad' : 'numeric'}
          placeholderTextColor={placeholderTextColor}
          {...inputProps}
        />
        <Text style={styles.suffix}>{currencyLabel(currency)}</Text>
      </View>
      {showPreview && numericValue !== null ? (
        <Text style={styles.preview}>Montant lu : {formatCurrency(numericValue, currency)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    ...typography.label,
    color: colors.neutral700,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.neutral900,
    backgroundColor: colors.white,
  },
  inputWithSuffix: {
    paddingRight: 76,
  },
  suffix: {
    ...typography.captionMedium,
    position: 'absolute',
    right: 14,
    color: colors.neutral500,
  },
  preview: {
    ...typography.caption,
    color: colors.neutral500,
  },
});
