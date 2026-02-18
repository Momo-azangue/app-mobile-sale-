import { useMemo, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { FormModal } from './FormModal';
import { SearchField } from './SearchField';

export interface SearchableSelectOption {
  label: string;
  value: string;
  subtitle?: string;
  keywords?: string;
}

interface SearchableSelectFieldProps {
  label: string;
  modalTitle: string;
  placeholder: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  emptyMessage?: string;
}

export function SearchableSelectField({
  label,
  modalTitle,
  placeholder,
  value,
  options,
  onChange,
  containerStyle,
  disabled = false,
  emptyMessage = 'Aucun resultat.',
}: SearchableSelectFieldProps) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
      return options;
    }
    return options.filter((option) => {
      const blob = `${option.label} ${option.subtitle ?? ''} ${option.keywords ?? ''}`.toLowerCase();
      return blob.includes(lower);
    });
  }, [options, query]);

  const openModal = () => {
    if (disabled) {
      return;
    }
    setQuery('');
    setVisible(true);
  };

  const closeModal = () => {
    setVisible(false);
    setQuery('');
  };

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    closeModal();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={openModal}
        disabled={disabled}
      >
        <Text style={[styles.triggerText, !selectedOption && styles.placeholder]}>
          {selectedOption?.label ?? placeholder}
        </Text>
        <Feather name='chevron-down' size={18} color={colors.neutral500} />
      </Pressable>

      <FormModal visible={visible} title={modalTitle} onClose={closeModal}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder='Rechercher...'
        />

        {filteredOptions.length === 0 ? (
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filteredOptions.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => handleSelect(option.value)}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{option.label}</Text>
                    {option.subtitle ? (
                      <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                    ) : null}
                  </View>
                  {active ? <Feather name='check' size={16} color={colors.primary600} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    ...typography.label,
    color: colors.neutral700,
  },
  trigger: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  triggerDisabled: {
    opacity: 0.6,
  },
  triggerText: {
    ...typography.body,
    color: colors.neutral900,
    flex: 1,
  },
  placeholder: {
    color: colors.neutral400,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    gap: 8,
  },
  optionRow: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionRowActive: {
    borderColor: colors.primary200,
    backgroundColor: colors.primary50,
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    ...typography.body,
    color: colors.neutral900,
  },
  optionLabelActive: {
    color: colors.primary600,
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.neutral500,
  },
  emptyText: {
    ...typography.caption,
    color: colors.neutral500,
  },
});
