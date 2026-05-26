import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import type {
  CategoryResponseDTO,
  ProductRequestDTO,
  ProductResponseDTO,
  TrackingMode,
} from '../../types/api';
import { AppButton } from '../../components/common/AppButton';
import { FormModal } from '../../components/common/FormModal';
import { InputField } from '../../components/common/InputField';
import { MoneyInput } from '../../components/common/MoneyInput';
import { SearchableSelectField, type SearchableSelectOption } from '../../components/common/SearchableSelectField';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

interface ProductFormModalProps {
  visible: boolean;
  product?: ProductResponseDTO | null;
  categories: CategoryResponseDTO[];
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: ProductRequestDTO) => Promise<void>;
}

const DEFAULT_AXES = ['Couleur', 'Stockage'];

export function ProductFormModal({
  visible,
  product,
  categories,
  saving = false,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('NONE');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [axes, setAxes] = useState<string[]>(DEFAULT_AXES);
  const [newAxis, setNewAxis] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }
    setName(product?.name ?? '');
    setBrand(product?.brand ?? '');
    setCategoryId(product?.categoryId ?? categories[0]?.id ?? '');
    setTrackingMode(product?.trackingMode ?? 'NONE');
    setSku(product?.sku ?? '');
    setBarcode(product?.barcode ?? '');
    setPrice(product?.price != null ? String(product.price) : '');
    setDescription(product?.description ?? '');
    setAxes(DEFAULT_AXES);
    setNewAxis('');
  }, [categories, product, visible]);

  const categoryOptions = useMemo<SearchableSelectOption[]>(
    () =>
      categories.map((category) => ({
        label: category.nom,
        value: category.id,
        subtitle: category.description,
      })),
    [categories],
  );

  const addAxis = () => {
    const trimmed = newAxis.trim();
    if (!trimmed) {
      return;
    }
    if (axes.some((axis) => axis.toLowerCase() === trimmed.toLowerCase())) {
      setNewAxis('');
      return;
    }
    setAxes((current) => [...current, trimmed]);
    setNewAxis('');
  };

  const removeAxis = (axisToRemove: string) => {
    setAxes((current) => current.filter((axis) => axis !== axisToRemove));
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Validation', 'Le nom du produit est obligatoire.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Validation', 'Selectionnez une categorie.');
      return;
    }
    const parsedPrice = Number(price.replace(',', '.').trim());
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Validation', 'Le prix de reference doit etre positif.');
      return;
    }

    await onSubmit({
      name: trimmedName,
      brand: brand.trim() || undefined,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      price: parsedPrice,
      description: description.trim() || undefined,
      categoryId,
      trackingMode,
    });
  };

  return (
    <FormModal
      visible={visible}
      title={product ? 'Modifier le modele' : 'Nouveau modele'}
      onClose={onClose}
    >
      {categories.length === 0 ? (
        <Text style={styles.warningText}>Aucune categorie disponible.</Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Modele produit</Text>
        <InputField label='Nom' value={name} onChangeText={setName} placeholder='Ex: iPhone 13' />
        <InputField label='Marque' value={brand} onChangeText={setBrand} placeholder='Ex: Apple' />
        <SearchableSelectField
          label='Categorie'
          modalTitle='Selectionner une categorie'
          placeholder='Choisir une categorie'
          value={categoryId}
          options={categoryOptions}
          onChange={setCategoryId}
          disabled={categories.length === 0}
        />
        <View style={styles.formGroup}>
          <Text style={styles.label}>Type</Text>
          <SegmentedControl
            options={[
              { label: 'Standard', value: 'NONE' },
              { label: 'IMEI', value: 'SERIAL' },
            ]}
            value={trackingMode}
            onChange={(value) => setTrackingMode(value as TrackingMode)}
          />
        </View>
        <View style={styles.row}>
          <InputField
            label='SKU modele'
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
        <MoneyInput
          label='Prix reference'
          value={price}
          onChangeText={setPrice}
          placeholder='125 000'
        />
        <InputField
          label='Description'
          value={description}
          onChangeText={setDescription}
          placeholder='Notes internes'
          multiline
          inputStyle={styles.multiline}
        />
      </View>

      {trackingMode === 'SERIAL' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Axes de variantes</Text>
          <View style={styles.axesWrap}>
            {axes.map((axis) => (
              <View key={axis} style={styles.axisChip}>
                <Text style={styles.axisText}>{axis}</Text>
                <Pressable onPress={() => removeAxis(axis)} hitSlop={8}>
                  <Feather name='x' size={14} color={colors.neutral600} />
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.row}>
            <InputField
              label='Nouvel axe'
              value={newAxis}
              onChangeText={setNewAxis}
              placeholder='Ex: RAM'
              containerStyle={styles.flex}
            />
            <View style={styles.addAxisButton}>
              <AppButton label='Ajouter' variant='outline' onPress={addAxis} />
            </View>
          </View>
        </View>
      ) : null}

      {!product ? (
        <Text style={styles.helperText}>Ajoutez ensuite des variantes pour pouvoir vendre ce modele.</Text>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <AppButton label='Retour' variant='outline' onPress={onClose} disabled={saving} />
        </View>
        <View style={styles.actionItem}>
          <AppButton
            label={saving ? 'Sauvegarde...' : product ? 'Mettre a jour' : 'Ajouter'}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={saving || categories.length === 0}
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
  formGroup: {
    gap: 8,
  },
  label: {
    ...typography.label,
    color: colors.neutral700,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  multiline: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  axesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  axisChip: {
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral50,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  axisText: {
    ...typography.label,
    color: colors.neutral700,
  },
  addAxisButton: {
    alignSelf: 'flex-end',
    minWidth: 108,
  },
  helperText: {
    ...typography.caption,
    color: colors.neutral500,
  },
  warningText: {
    ...typography.caption,
    color: colors.warning600,
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
