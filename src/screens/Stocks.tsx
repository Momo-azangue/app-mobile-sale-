import { ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  createProduct,
  createStockMovement,
  deleteProduct,
  listCategories,
  listProducts,
  listStockMovements,
  updateProduct,
} from '../api/services';
import { getErrorMessage } from '../api/errors';
import { formatCurrency, formatDate } from '../utils/format';
import type {
  CategoryResponseDTO,
  MovementSource,
  MovementType,
  ProductResponseDTO,
  StockMovementResponseDTO,
} from '../types/api';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { AppButton } from '../components/common/AppButton';
import { ChipGroup, type ChipOption } from '../components/common/ChipGroup';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { FormModal } from '../components/common/FormModal';
import { InputField } from '../components/common/InputField';
import { LoadingState } from '../components/common/LoadingState';
import { SearchableSelectField, type SearchableSelectOption } from '../components/common/SearchableSelectField';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SearchField } from '../components/common/SearchField';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface StocksScreenProps {
  refreshSignal: number;
}

interface ComputedStock {
  available: number;
  consigned: number;
}

type MovementVisual = {
  icon: ComponentProps<typeof Feather>['name'];
  color: string;
  background: string;
  sign: '+' | '-';
};

const MOVEMENT_TYPE_OPTIONS: ChipOption[] = [
  { label: 'Entree', value: 'ENTREE' },
  { label: 'Sortie', value: 'SORTIE' },
  { label: 'Transfert', value: 'TRANSFERT' },
  { label: 'Envoi', value: 'ENVOI' },
  { label: 'Production', value: 'PRODUCTION' },
  { label: 'Mise rebut', value: 'MISE_AU_REBUT' },
  { label: 'Consig. +', value: 'CONSIGNATION_ENTREE' },
  { label: 'Consig. -', value: 'CONSIGNATION_SORTIE' },
];

const MOVEMENT_SOURCE_OPTIONS: ChipOption[] = [
  { label: 'Aucune', value: '' },
  { label: 'Vente', value: 'VENTE' },
  { label: 'Retour', value: 'RETOUR_CLIENT' },
  { label: 'Commande', value: 'COMMANDE_FOURNISSEUR' },
  { label: 'Ajustement', value: 'AJUSTEMENT' },
  { label: 'Transfert', value: 'TRANSFERT' },
  { label: 'SAV', value: 'SAV' },
  { label: 'Production', value: 'PRODUCTION' },
  { label: 'Destruction', value: 'DESTRUCTION' },
  { label: 'Consignation', value: 'CONSIGNATION' },
];

function movementToDelta(type: MovementType, quantity: number): ComputedStock {
  switch (type) {
    case 'ENTREE':
    case 'PRODUCTION':
      return { available: quantity, consigned: 0 };
    case 'SORTIE':
    case 'ENVOI':
    case 'MISE_AU_REBUT':
      return { available: -quantity, consigned: 0 };
    case 'CONSIGNATION_ENTREE':
      return { available: 0, consigned: quantity };
    case 'CONSIGNATION_SORTIE':
      return { available: 0, consigned: -quantity };
    case 'TRANSFERT':
    default:
      return { available: 0, consigned: 0 };
  }
}

function movementVisual(type: MovementType): MovementVisual {
  switch (type) {
    case 'ENTREE':
    case 'PRODUCTION':
      return { icon: 'trending-up', color: colors.success600, background: colors.success100, sign: '+' };
    case 'SORTIE':
    case 'ENVOI':
    case 'MISE_AU_REBUT':
      return { icon: 'trending-down', color: colors.danger500, background: colors.danger100, sign: '-' };
    case 'CONSIGNATION_ENTREE':
      return { icon: 'repeat', color: colors.warning600, background: colors.warning100, sign: '+' };
    case 'CONSIGNATION_SORTIE':
      return { icon: 'repeat', color: colors.warning600, background: colors.warning100, sign: '-' };
    case 'TRANSFERT':
    default:
      return { icon: 'shuffle', color: colors.primary600, background: colors.primary100, sign: '+' };
  }
}

export function StocksScreen({ refreshSignal }: StocksScreenProps) {
  const [activeTab, setActiveTab] = useState<'produits' | 'mouvements'>('produits');
  const [productQuery, setProductQuery] = useState('');
  const [movementQuery, setMovementQuery] = useState('');
  const [showProductFilters, setShowProductFilters] = useState(false);
  const [showMovementFilters, setShowMovementFilters] = useState(false);
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'available' | 'low' | 'zero'>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | MovementType>('all');
  const [movementProductFilter, setMovementProductFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [movements, setMovements] = useState<StockMovementResponseDTO[]>([]);
  const [categories, setCategories] = useState<CategoryResponseDTO[]>([]);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategoryId, setProductCategoryId] = useState('');

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementProductId, setMovementProductId] = useState('');
  const [movementQuantity, setMovementQuantity] = useState('1');
  const [movementType, setMovementType] = useState<MovementType>('ENTREE');
  const [movementSource, setMovementSource] = useState<MovementSource | ''>('');
  const [movementReason, setMovementReason] = useState('');

  const loadStockData = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const [fetchedProducts, fetchedMovements, fetchedCategories] = await Promise.all([
        listProducts(),
        listStockMovements(),
        listCategories(),
      ]);
      setProducts(fetchedProducts);
      setMovements(fetchedMovements);
      setCategories(fetchedCategories);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStockData(true);
  }, [loadStockData, refreshSignal]);
  const { refreshing, onRefresh } = usePullToRefresh(() => loadStockData(false));

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const categoryOptions = useMemo<SearchableSelectOption[]>(
    () =>
      categories.map((category) => ({
        label: category.nom,
        value: category.id,
        subtitle: category.description,
      })),
    [categories]
  );
  const categoryFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [{ label: 'Toutes les categories', value: 'all' }, ...categoryOptions],
    [categoryOptions]
  );
  const productOptions = useMemo<SearchableSelectOption[]>(
    () =>
      products.map((product) => ({
        label: product.name,
        value: product.id,
        subtitle: product.categoryName ? `Categorie: ${product.categoryName}` : undefined,
      })),
    [products]
  );
  const movementProductFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [{ label: 'Tous les produits', value: 'all' }, ...productOptions],
    [productOptions]
  );
  const stockFilterOptions = useMemo<ChipOption[]>(
    () => [
      { label: 'Tous', value: 'all' },
      { label: 'Disponible', value: 'available' },
      { label: 'Stock bas', value: 'low' },
      { label: 'Rupture', value: 'zero' },
    ],
    []
  );
  const movementTypeFilterOptions = useMemo<ChipOption[]>(
    () => [{ label: 'Tous', value: 'all' }, ...MOVEMENT_TYPE_OPTIONS],
    []
  );
  const productFilterCount =
    (productCategoryFilter === 'all' ? 0 : 1)
    + (productStockFilter === 'all' ? 0 : 1);
  const movementFilterCount =
    (movementProductFilter === 'all' ? 0 : 1)
    + (movementTypeFilter === 'all' ? 0 : 1);

  const stockByProduct = useMemo(() => {
    const byProduct = new Map<string, ComputedStock>();

    for (const movement of movements) {
      const current = byProduct.get(movement.productId) ?? { available: 0, consigned: 0 };
      const delta = movementToDelta(movement.type, movement.quantity);

      byProduct.set(movement.productId, {
        available: current.available + delta.available,
        consigned: current.consigned + delta.consigned,
      });
    }

    return byProduct;
  }, [movements]);

  const filteredProducts = useMemo(() => {
    const lower = productQuery.toLowerCase();
    return products.filter((product) => {
      const blob = `${product.name} ${product.categoryName ?? ''}`.toLowerCase();
      const stock = stockByProduct.get(product.id) ?? { available: 0, consigned: 0 };
      const matchQuery = blob.includes(lower);
      const matchCategory = productCategoryFilter === 'all' ? true : product.categoryId === productCategoryFilter;
      const matchStock =
        productStockFilter === 'all'
          ? true
          : productStockFilter === 'available'
            ? stock.available > 0
            : productStockFilter === 'low'
              ? stock.available > 0 && stock.available <= 5
              : stock.available <= 0;
      return matchQuery && matchCategory && matchStock;
    });
  }, [productCategoryFilter, productQuery, productStockFilter, products, stockByProduct]);

  const filteredMovements = useMemo(() => {
    const lower = movementQuery.toLowerCase();
    return movements.filter((movement) => {
      const productName = productById.get(movement.productId)?.name ?? movement.productId;
      const blob = `${productName} ${movement.type} ${movement.source ?? ''} ${movement.reason ?? ''}`.toLowerCase();
      const matchQuery = blob.includes(lower);
      const matchType = movementTypeFilter === 'all' ? true : movement.type === movementTypeFilter;
      const matchProduct = movementProductFilter === 'all' ? true : movement.productId === movementProductFilter;
      return matchQuery && matchType && matchProduct;
    }).sort((left, right) => {
      const leftDate = left.date ? new Date(left.date).getTime() : 0;
      const rightDate = right.date ? new Date(right.date).getTime() : 0;
      return rightDate - leftDate;
    });
  }, [movementProductFilter, movementQuery, movementTypeFilter, movements, productById]);

  const openCreateProductModal = () => {
    setEditingProductId(null);
    setProductName('');
    setProductPrice('');
    setProductCategoryId(categories[0]?.id ?? '');
    setShowProductModal(true);
  };

  const openEditProductModal = (product: ProductResponseDTO) => {
    setEditingProductId(product.id);
    setProductName(product.name);
    setProductPrice(product.price != null ? String(product.price) : '');
    setProductCategoryId(product.categoryId ?? categories[0]?.id ?? '');
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProductId(null);
    setProductName('');
    setProductPrice('');
    setProductCategoryId('');
  };

  const closeMovementModal = () => {
    setShowMovementModal(false);
    setMovementProductId('');
    setMovementQuantity('1');
    setMovementType('ENTREE');
    setMovementSource('');
    setMovementReason('');
  };

  const handleSaveProduct = async () => {
    if (!productName.trim()) {
      Alert.alert('Validation', 'Le nom du produit est obligatoire.');
      return;
    }
    if (!productCategoryId) {
      Alert.alert('Validation', 'Selectionnez une categorie.');
      return;
    }
    const parsedPrice = Number(productPrice.replace(',', '.').trim());
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Validation', 'Le prix doit etre un nombre positif.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: productName.trim(),
        price: parsedPrice,
        categoryId: productCategoryId,
      };

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
      } else {
        await createProduct(payload);
      }

      closeProductModal();
      await loadStockData();
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = (product: ProductResponseDTO) => {
    Alert.alert('Supprimer produit', `Supprimer ${product.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(product.id);
            await loadStockData();
          } catch (deleteError) {
            Alert.alert('Erreur', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const handleCreateMovement = async () => {
    if (!movementProductId) {
      Alert.alert('Validation', 'Selectionnez un produit.');
      return;
    }
    const parsedQuantity = Number(movementQuantity.trim());
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert('Validation', 'La quantite doit etre un entier positif.');
      return;
    }

    setSaving(true);
    try {
      await createStockMovement({
        productId: movementProductId,
        quantity: Math.trunc(parsedQuantity),
        type: movementType,
        source: movementSource || undefined,
        reason: movementReason.trim() || undefined,
        date: new Date().toISOString(),
      });

      closeMovementModal();
      await loadStockData();
    } catch (createError) {
      Alert.alert('Erreur', getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message='Chargement stock...' />;
  }

  if (error) {
    return <ErrorState title='Erreur stock' message={error} onRetry={() => void loadStockData()} />;
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
        }
      >
        <ScreenHeader title='Gestion de stock' subtitle='Produits et mouvements' />

        <SegmentedControl
          options={[
            { label: 'Produits', value: 'produits' },
            { label: 'Mouvements', value: 'mouvements' },
          ]}
          value={activeTab}
          onChange={(value) => setActiveTab(value as 'produits' | 'mouvements')}
        />

        <View style={styles.topAction}>
          <AppButton
            label={activeTab === 'produits' ? 'Nouveau produit' : 'Nouveau mouvement'}
            onPress={() => {
              if (activeTab === 'produits') {
                openCreateProductModal();
              } else {
                setShowMovementModal(true);
              }
            }}
          />
        </View>

        {activeTab === 'produits' ? (
          <>
            <View style={styles.searchRow}>
              <SearchField
                value={productQuery}
                onChangeText={setProductQuery}
                placeholder='Rechercher un produit...'
                style={styles.searchField}
              />
              <Pressable
                style={[styles.filterButton, showProductFilters && styles.filterButtonActive]}
                onPress={() => setShowProductFilters((current) => !current)}
              >
                <Feather name='sliders' size={16} color={showProductFilters ? colors.white : colors.neutral700} />
                <Text style={[styles.filterButtonLabel, showProductFilters && styles.filterButtonLabelActive]}>
                  Filtrer
                </Text>
                {productFilterCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{productFilterCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
            {showProductFilters ? (
              <View style={styles.filtersPanel}>
                <SearchableSelectField
                  label='Categorie'
                  modalTitle='Filtrer par categorie'
                  placeholder='Toutes les categories'
                  value={productCategoryFilter}
                  options={categoryFilterOptions}
                  onChange={setProductCategoryFilter}
                />
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Niveau de stock</Text>
                  <ChipGroup
                    options={stockFilterOptions}
                    value={productStockFilter}
                    onChange={(value) => setProductStockFilter(value as 'all' | 'available' | 'low' | 'zero')}
                    layout='row-scroll'
                    tone='soft'
                  />
                </View>
                <Pressable
                  onPress={() => {
                    setProductCategoryFilter('all');
                    setProductStockFilter('all');
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.resetLabel}>Reinitialiser</Text>
                </Pressable>
              </View>
            ) : null}

            {filteredProducts.length === 0 ? (
              <EmptyState
                icon='package'
                title='Aucun produit'
                description='Ajoutez des produits ou modifiez votre recherche.'
              />
            ) : (
              <View style={styles.list}>
                {filteredProducts.map((product) => {
                  const stock = stockByProduct.get(product.id) ?? { available: 0, consigned: 0 };
                  return (
                    <View key={product.id} style={styles.card}>
                      <View style={styles.productHeader}>
                        <View style={styles.productTitleWrap}>
                          <Text style={styles.productName}>{product.name}</Text>
                          <Text style={styles.productPrice}>
                            {product.price != null ? formatCurrency(product.price) : '-'}
                          </Text>
                        </View>
                        <View style={styles.actionsWrap}>
                          <Pressable onPress={() => openEditProductModal(product)}>
                            <Feather name='edit-2' size={18} color={colors.neutral600} />
                          </Pressable>
                          <Pressable onPress={() => handleDeleteProduct(product)}>
                            <Feather name='trash-2' size={18} color={colors.danger600} />
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.categoryChip}>
                        <Text style={styles.categoryText}>{product.categoryName ?? 'Sans categorie'}</Text>
                      </View>

                      <View style={styles.cardGrid}>
                        <View style={styles.metricBlock}>
                          <Text style={styles.gridLabel}>Stock disponible</Text>
                          <Text style={styles.gridValue}>{stock.available}</Text>
                        </View>
                        <View style={styles.metricBlock}>
                          <Text style={styles.gridLabel}>Stock consigne</Text>
                          <Text style={styles.gridValue}>{stock.consigned}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.searchRow}>
              <SearchField
                value={movementQuery}
                onChangeText={setMovementQuery}
                placeholder='Rechercher un mouvement...'
                style={styles.searchField}
              />
              <Pressable
                style={[styles.filterButton, showMovementFilters && styles.filterButtonActive]}
                onPress={() => setShowMovementFilters((current) => !current)}
              >
                <Feather name='sliders' size={16} color={showMovementFilters ? colors.white : colors.neutral700} />
                <Text style={[styles.filterButtonLabel, showMovementFilters && styles.filterButtonLabelActive]}>
                  Filtrer
                </Text>
                {movementFilterCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{movementFilterCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
            {showMovementFilters ? (
              <View style={styles.filtersPanel}>
                <SearchableSelectField
                  label='Produit'
                  modalTitle='Filtrer par produit'
                  placeholder='Tous les produits'
                  value={movementProductFilter}
                  options={movementProductFilterOptions}
                  onChange={setMovementProductFilter}
                />
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Type de mouvement</Text>
                  <ChipGroup
                    options={movementTypeFilterOptions}
                    value={movementTypeFilter}
                    onChange={(value) => setMovementTypeFilter(value as 'all' | MovementType)}
                    layout='row-scroll'
                    tone='soft'
                  />
                </View>
                <Pressable
                  onPress={() => {
                    setMovementProductFilter('all');
                    setMovementTypeFilter('all');
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.resetLabel}>Reinitialiser</Text>
                </Pressable>
              </View>
            ) : null}
            {filteredMovements.length === 0 ? (
              <EmptyState
                icon='repeat'
                title='Aucun mouvement'
                description='Ajoutez votre premier mouvement de stock.'
              />
            ) : (
              <View style={styles.list}>
                {filteredMovements.map((movement) => {
                  const visual = movementVisual(movement.type);
                  const productName = productById.get(movement.productId)?.name ?? movement.productId;

                  return (
                    <View key={movement.id} style={styles.card}>
                      <View style={styles.movementHeader}>
                        <View style={[styles.iconBubble, { backgroundColor: visual.background }]}>
                          <Feather name={visual.icon} size={18} color={visual.color} />
                        </View>

                        <View style={styles.movementText}>
                          <Text style={styles.productName}>{productName}</Text>
                          <Text style={styles.productMeta}>{movement.reason || movement.source || '-'}</Text>
                        </View>

                        <Text style={styles.movementQty}>
                          {visual.sign}
                          {movement.quantity}
                        </Text>
                      </View>

                      <Text style={styles.gridLabel}>
                        {movement.type} - {formatDate(movement.date)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <FormModal
        visible={showProductModal}
        title={editingProductId ? 'Modifier produit' : 'Nouveau produit'}
        onClose={closeProductModal}
      >
        {categories.length === 0 ? (
          <Text style={styles.warningText}>Aucune categorie disponible. Creez une categorie avant.</Text>
        ) : null}

        <InputField
          label='Nom'
          value={productName}
          onChangeText={setProductName}
          placeholder='Nom du produit'
        />
        <InputField
          label='Prix'
          value={productPrice}
          onChangeText={setProductPrice}
          placeholder='Ex: 1500'
          keyboardType='numeric'
        />
        <SearchableSelectField
          label='Categorie'
          modalTitle='Selectionner une categorie'
          placeholder='Choisir une categorie'
          value={productCategoryId}
          options={categoryOptions}
          onChange={setProductCategoryId}
          disabled={categories.length === 0}
        />

        <View style={styles.modalActions}>
          <View style={styles.actionItem}>
            <AppButton label='Retour' variant='outline' onPress={closeProductModal} disabled={saving} />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={saving ? 'Sauvegarde...' : editingProductId ? 'Mettre a jour' : 'Ajouter'}
              onPress={() => {
                void handleSaveProduct();
              }}
              disabled={saving || categories.length === 0}
            />
          </View>
        </View>
      </FormModal>

      <FormModal
        visible={showMovementModal}
        title='Nouveau mouvement'
        onClose={closeMovementModal}
      >
        <SearchableSelectField
          label='Produit'
          modalTitle='Selectionner un produit'
          placeholder='Choisir un produit'
          value={movementProductId}
          options={productOptions}
          onChange={setMovementProductId}
          disabled={products.length === 0}
        />

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Type</Text>
          <ChipGroup
            options={MOVEMENT_TYPE_OPTIONS}
            value={movementType}
            onChange={(value) => setMovementType(value as MovementType)}
            layout='wrap'
            tone='soft'
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Source (optionnel)</Text>
          <ChipGroup
            options={MOVEMENT_SOURCE_OPTIONS}
            value={movementSource}
            onChange={(value) => setMovementSource(value as MovementSource | '')}
            layout='row-scroll'
            tone='soft'
          />
        </View>

        <InputField
          label='Quantite'
          value={movementQuantity}
          onChangeText={setMovementQuantity}
          placeholder='1'
          keyboardType='numeric'
        />
        <InputField
          label='Motif (optionnel)'
          value={movementReason}
          onChangeText={setMovementReason}
          placeholder='Ex: ajustement inventaire'
        />

        <View style={styles.modalActions}>
          <View style={styles.actionItem}>
            <AppButton label='Retour' variant='outline' onPress={closeMovementModal} disabled={saving} />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={saving ? 'Creation...' : 'Ajouter'}
              onPress={() => {
                void handleCreateMovement();
              }}
              disabled={saving}
            />
          </View>
        </View>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  topAction: {
    marginTop: 14,
    marginBottom: 14,
  },
  searchRow: {
    marginTop: 4,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchField: {
    flex: 1,
  },
  filterButton: {
    minHeight: 46,
    minWidth: 96,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral300,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadows.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary600,
    borderColor: colors.primary600,
  },
  filterButtonLabel: {
    ...typography.label,
    color: colors.neutral700,
  },
  filterButtonLabelActive: {
    color: colors.white,
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.warning600,
  },
  filterBadgeText: {
    ...typography.captionMedium,
    color: colors.white,
  },
  filtersPanel: {
    marginBottom: 8,
    gap: 10,
  },
  resetLabel: {
    ...typography.captionMedium,
    color: colors.primary600,
    paddingHorizontal: 4,
  },
  list: {
    gap: 12,
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 16,
    ...shadows.sm,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  productTitleWrap: {
    flex: 1,
  },
  productName: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  productPrice: {
    marginTop: 4,
    ...typography.label,
    color: colors.neutral600,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  categoryChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryText: {
    ...typography.captionMedium,
    color: colors.primary600,
  },
  cardGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  metricBlock: {
    flex: 1,
  },
  gridLabel: {
    ...typography.caption,
    color: colors.neutral500,
  },
  gridValue: {
    marginTop: 4,
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  movementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBubble: {
    padding: 10,
    borderRadius: radius.md,
    marginRight: 12,
  },
  movementText: {
    flex: 1,
  },
  productMeta: {
    marginTop: 4,
    ...typography.caption,
    color: colors.neutral500,
  },
  movementQty: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  warningText: {
    ...typography.label,
    color: colors.warning600,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    ...typography.label,
    color: colors.neutral700,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionItem: {
    flex: 1,
  },
});
