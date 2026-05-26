import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import type {
  ProductResponseDTO,
  ProductVariantRequestDTO,
  ProductVariantResponseDTO,
  ProviderResponseDTO,
} from '../../types/api';
import { AppButton } from '../../components/common/AppButton';
import { FormModal } from '../../components/common/FormModal';
import { InputField } from '../../components/common/InputField';
import { MoneyInput } from '../../components/common/MoneyInput';
import { SearchableSelectField, type SearchableSelectOption } from '../../components/common/SearchableSelectField';
import { colors } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface VariantSubmitPayload {
  payload: ProductVariantRequestDTO;
  initialStock: number;
}

interface VariantFormModalProps {
  visible: boolean;
  product: ProductResponseDTO;
  variant?: ProductVariantResponseDTO | null;
  existingVariants: ProductVariantResponseDTO[];
  providers: ProviderResponseDTO[];
  saving?: boolean;
  onClose: () => void;
  onSubmit: (data: VariantSubmitPayload) => Promise<void>;
}

const DEFAULT_SERIAL_AXES = ['Couleur', 'Stockage'];

function axisLabelToKey(axis: string): string {
  const normalized = axis.trim().toLowerCase();
  if (normalized === 'couleur') return 'color';
  if (normalized === 'stockage') return 'storage';
  return normalized.replace(/\s+/g, '_');
}

function keyToAxisLabel(key: string): string {
  if (key === 'color') return 'Couleur';
  if (key === 'storage') return 'Stockage';
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildVariantLabel(attributes: Record<string, string>): string {
  return Object.values(attributes)
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
}

export function VariantFormModal({
  visible,
  product,
  variant,
  existingVariants,
  providers,
  saving = false,
  onClose,
  onSubmit,
}: VariantFormModalProps) {
  const isSerial = product.trackingMode === 'SERIAL';
  const editing = Boolean(variant);

  const inferredAxes = useMemo(() => {
    const keys = new Set<string>();
    existingVariants.forEach((item) => {
      Object.keys(item.attributes ?? {}).forEach((key) => keys.add(keyToAxisLabel(key)));
    });
    if (variant?.attributes) {
      Object.keys(variant.attributes).forEach((key) => keys.add(keyToAxisLabel(key)));
    }
    if (keys.size === 0 && isSerial) {
      DEFAULT_SERIAL_AXES.forEach((axis) => keys.add(axis));
    }
    return Array.from(keys);
  }, [existingVariants, isSerial, variant]);

  const [name, setName] = useState('');
  const [labelTouched, setLabelTouched] = useState(false);
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [minStock, setMinStock] = useState('0');
  const [initialStock, setInitialStock] = useState('0');
  const [consignment, setConsignment] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [providerPrice, setProviderPrice] = useState('');
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) {
      return;
    }
    setName(variant?.name ?? '');
    setLabelTouched(Boolean(variant?.name));
    setSku(variant?.sku ?? '');
    setBarcode(variant?.barcode ?? '');
    setPrice(variant?.price != null ? String(variant.price) : '');
    setMinStock(String(variant?.minStock ?? 0));
    setInitialStock('0');
    setConsignment(Boolean(variant?.consignment));
    setProviderId(variant?.providerId ?? '');
    setProviderPrice(variant?.providerPrice != null ? String(variant.providerPrice) : '');
    const nextAttributes: Record<string, string> = {};
    inferredAxes.forEach((axis) => {
      const key = axisLabelToKey(axis);
      nextAttributes[axis] = variant?.attributes?.[key] ?? '';
    });
    setAttributeValues(nextAttributes);
  }, [inferredAxes, variant, visible]);

  const providerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      providers.map((provider) => ({
        label: provider.name,
        value: provider.id,
        subtitle: provider.email ?? provider.phone,
      })),
    [providers],
  );

  const suggestionsByAxis = useMemo(() => {
    const result: Record<string, string[]> = {};
    inferredAxes.forEach((axis) => {
      const key = axisLabelToKey(axis);
      const values = new Set<string>();
      existingVariants.forEach((item) => {
        const value = item.attributes?.[key];
        if (value) {
          values.add(value);
        }
      });
      result[axis] = Array.from(values);
    });
    return result;
  }, [existingVariants, inferredAxes]);

  const updateAttribute = (axis: string, value: string) => {
    const next = { ...attributeValues, [axis]: value };
    setAttributeValues(next);
    if (!labelTouched) {
      setName(buildVariantLabel(next));
    }
  };

  const handleSubmit = async () => {
    const parsedPrice = price.trim() ? Number(price.replace(',', '.').trim()) : undefined;
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      Alert.alert('Validation', 'Le prix doit etre positif ou vide.');
      return;
    }
    const parsedMinStock = minStock.trim() ? Math.trunc(Number(minStock.trim())) : 0;
    if (!Number.isFinite(parsedMinStock) || parsedMinStock < 0) {
      Alert.alert('Validation', 'Le seuil minimum doit etre un entier positif ou nul.');
      return;
    }
    const parsedInitialStock = initialStock.trim() ? Math.trunc(Number(initialStock.trim())) : 0;
    if (!editing && !isSerial && (!Number.isFinite(parsedInitialStock) || parsedInitialStock < 0)) {
      Alert.alert('Validation', 'Le stock initial doit etre un entier positif ou nul.');
      return;
    }
    if (consignment && !providerId) {
      Alert.alert('Validation', 'Selectionnez le fournisseur de cette variante consignee.');
      return;
    }
    const parsedProviderPrice = providerPrice.trim()
      ? Number(providerPrice.replace(',', '.').trim())
      : undefined;
    if (parsedProviderPrice !== undefined && (!Number.isFinite(parsedProviderPrice) || parsedProviderPrice < 0)) {
      Alert.alert('Validation', "Le prix d'achat doit etre positif ou vide.");
      return;
    }

    const attributes = Object.fromEntries(
      Object.entries(attributeValues)
        .map(([axis, value]) => [axisLabelToKey(axis), value.trim()])
        .filter(([, value]) => Boolean(value)),
    );
    const generatedName = buildVariantLabel(attributeValues);

    await onSubmit({
      payload: {
        name: name.trim() || generatedName || undefined,
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        attributes,
        price: parsedPrice,
        stock: isSerial ? 0 : editing ? variant?.quantity ?? 0 : 0,
        minStock: parsedMinStock,
        consignment,
        providerId: consignment ? providerId : undefined,
        providerPrice: consignment ? parsedProviderPrice : undefined,
      },
      initialStock: editing || isSerial ? 0 : parsedInitialStock,
    });
  };

  return (
    <FormModal
      visible={visible}
      title={editing ? 'Modifier la variante' : 'Ajouter une variante'}
      onClose={onClose}
    >
      {isSerial ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attributs</Text>
          {inferredAxes.map((axis) => (
            <View key={axis} style={styles.attributeField}>
              <InputField
                label={axis}
                value={attributeValues[axis] ?? ''}
                onChangeText={(value) => updateAttribute(axis, value)}
                placeholder={axis === 'Couleur' ? 'Ex: Noir' : axis === 'Stockage' ? 'Ex: 256Go' : 'Valeur'}
              />
              {suggestionsByAxis[axis]?.length ? (
                <Text style={styles.helperText}>
                  Suggestions : {suggestionsByAxis[axis].join(', ')}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reference vendable</Text>
        <InputField
          label='Libelle'
          value={name}
          onChangeText={(value) => {
            setLabelTouched(true);
            setName(value);
          }}
          placeholder={isSerial ? 'Ex: Noir 256Go' : product.name}
        />
        <View style={styles.row}>
          <InputField
            label='SKU'
            value={sku}
            onChangeText={setSku}
            placeholder='Optionnel'
            containerStyle={styles.flex}
          />
          <InputField
            label='Code-barres'
            value={barcode}
            onChangeText={setBarcode}
            placeholder='Optionnel'
            containerStyle={styles.flex}
          />
        </View>
        <View style={styles.row}>
          <MoneyInput
            label='Prix'
            value={price}
            onChangeText={setPrice}
            placeholder={product.price != null ? String(product.price) : 'Hérite du modele'}
            containerStyle={styles.flex}
          />
          <InputField
            label='Seuil alerte'
            value={minStock}
            onChangeText={setMinStock}
            placeholder='0'
            keyboardType='numeric'
            containerStyle={styles.flex}
          />
        </View>
        {!editing && !isSerial ? (
          <InputField
            label='Stock initial'
            value={initialStock}
            onChangeText={setInitialStock}
            placeholder='0'
            keyboardType='numeric'
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.sectionTitle}>Consignation</Text>
            <Text style={styles.helperText}>Activez si le stock appartient au fournisseur.</Text>
          </View>
          <Switch
            value={consignment}
            onValueChange={(next) => {
              setConsignment(next);
              if (!next) {
                setProviderId('');
                setProviderPrice('');
              }
            }}
            trackColor={{ false: colors.neutral300, true: colors.primary600 }}
            thumbColor={colors.white}
          />
        </View>
        {consignment ? (
          <>
            <SearchableSelectField
              label='Fournisseur'
              modalTitle='Selectionner un fournisseur'
              placeholder={providers.length === 0 ? 'Aucun fournisseur' : 'Choisir un fournisseur'}
              value={providerId}
              options={providerOptions}
              onChange={setProviderId}
              disabled={providers.length === 0}
            />
            <MoneyInput
              label="Prix d'achat"
              value={providerPrice}
              onChangeText={setProviderPrice}
              placeholder='Optionnel'
            />
          </>
        ) : null}
      </View>

      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <AppButton label='Retour' variant='outline' onPress={onClose} disabled={saving} />
        </View>
        <View style={styles.actionItem}>
          <AppButton
            label={saving ? 'Sauvegarde...' : editing ? 'Mettre a jour' : 'Ajouter'}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={saving}
            loading={saving}
          />
        </View>
      </View>
    </FormModal>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  attributeField: {
    gap: 4,
  },
  helperText: {
    ...typography.caption,
    color: colors.neutral500,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleTextWrap: {
    flex: 1,
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionItem: {
    flex: 1,
  },
});
