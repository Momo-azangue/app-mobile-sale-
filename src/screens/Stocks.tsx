import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  createProduct,
  createStockMovement,
  deleteProduct,
  getProductUnitBySerialNumber,
  listCategories,
  listClients,
  listProducts,
  listProductVariants,
  listProviders,
  listStockMovements,
  updateProduct,
} from '../api/services';
import { getErrorMessage } from '../api/errors';
import { AppButton } from '../components/common/AppButton';
import { ChipGroup, type ChipOption } from '../components/common/ChipGroup';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { FormModal } from '../components/common/FormModal';
import { InputField } from '../components/common/InputField';
import { MoneyInput } from '../components/common/MoneyInput';
import { SkeletonList } from '../components/common/SkeletonList';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { SearchableSelectField, type SearchableSelectOption } from '../components/common/SearchableSelectField';
import { SearchField } from '../components/common/SearchField';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { useToast } from '../components/common/ToastProvider';
import { useCachedResource } from '../hooks/useCachedResource';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useFormatCurrency } from '../context/AppSettingsContext';
import { formatDate } from '../utils/format';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import type {
  CategoryResponseDTO,
  ClientResponseDTO,
  MovementSource,
  MovementType,
  ProductRequestDTO,
  ProductResponseDTO,
  ProductVariantResponseDTO,
  ProviderResponseDTO,
  StockMovementResponseDTO,
} from '../types/api';
import { ProductFormModal } from './stocks/ProductFormModal';

interface StocksScreenProps {
  refreshSignal: number;
  onProductChanged?: () => void;
  onSelectProduct?: (productId: string, highlightedVariantId?: string) => void;
}

interface StockScreenData {
  products: ProductResponseDTO[];
  variantsByProduct: Record<string, ProductVariantResponseDTO[]>;
  movements: StockMovementResponseDTO[];
  categories: CategoryResponseDTO[];
  providers: ProviderResponseDTO[];
  clients: ClientResponseDTO[];
}

interface ProductAggregate {
  product: ProductResponseDTO;
  variants: ProductVariantResponseDTO[];
  quantity: number;
  consignedQuantity: number;
  totalUnits: number;
  lowStockCount: number;
}

type MovementVisual = {
  icon: ComponentProps<typeof Feather>['name'];
  color: string;
  background: string;
  sign: '+' | '-' | '~';
};

const MOVEMENT_TYPE_OPTIONS: ChipOption[] = [
  { label: 'Entree', value: 'ENTREE' },
  { label: 'Sortie', value: 'SORTIE' },
  { label: 'Transfert', value: 'TRANSFERT' },
  { label: 'Envoi', value: 'ENVOI' },
  { label: 'Production', value: 'PRODUCTION' },
  { label: 'Rebut', value: 'MISE_AU_REBUT' },
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

function parseSerialNumbers(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSerialNumber(value: string): string {
  return value.trim();
}

function acceptsSerialUnitCreation(type: MovementType): boolean {
  return type === 'ENTREE' || type === 'CONSIGNATION_ENTREE' || type === 'PRODUCTION';
}

function variantLabel(variant: ProductVariantResponseDTO): string {
  if (variant.name?.trim()) {
    return variant.name.trim();
  }
  const attributes = Object.values(variant.attributes ?? {})
    .map((value) => value.trim())
    .filter(Boolean);
  return attributes.length ? attributes.join(' • ') : 'Variante standard';
}

function aggregateProduct(product: ProductResponseDTO, variants: ProductVariantResponseDTO[]): ProductAggregate {
  const quantity = variants.reduce((sum, variant) => sum + variant.quantity, 0);
  const consignedQuantity = variants.reduce((sum, variant) => sum + variant.consignedQuantity, 0);
  const lowStockCount = variants.filter(
    (variant) => variant.minStock > 0 && variant.quantity <= variant.minStock,
  ).length;
  return {
    product,
    variants,
    quantity,
    consignedQuantity,
    totalUnits: quantity + consignedQuantity,
    lowStockCount,
  };
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
      return { icon: 'shuffle', color: colors.primary600, background: colors.primary100, sign: '~' };
  }
}

export function StocksScreen({ refreshSignal, onProductChanged, onSelectProduct }: StocksScreenProps) {
  const fmtCurrency = useFormatCurrency();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'produits' | 'mouvements'>('produits');
  const [productQuery, setProductQuery] = useState('');
  const [movementQuery, setMovementQuery] = useState('');
  const [showProductFilters, setShowProductFilters] = useState(false);
  const [showMovementFilters, setShowMovementFilters] = useState(false);
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'available' | 'low' | 'zero'>('all');
  const [movementProductFilter, setMovementProductFilter] = useState('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | MovementType>('all');

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductResponseDTO | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [movementImeiScannerVisible, setMovementImeiScannerVisible] = useState(false);
  const [movementProductId, setMovementProductId] = useState('');
  const [movementVariantId, setMovementVariantId] = useState('');
  const [movementQuantity, setMovementQuantity] = useState('1');
  const [movementType, setMovementType] = useState<MovementType>('ENTREE');
  const [movementSource, setMovementSource] = useState<MovementSource | ''>('');
  const [movementReason, setMovementReason] = useState('');
  const [movementProviderId, setMovementProviderId] = useState('');
  const [movementUnitPurchasePrice, setMovementUnitPurchasePrice] = useState('');
  const [movementSerialNumbers, setMovementSerialNumbers] = useState('');
  const [movementClientId, setMovementClientId] = useState('');
  const [movementReference, setMovementReference] = useState('');

  const fetchStockData = useCallback(async (): Promise<StockScreenData> => {
    const [products, movements, categories, providers, clients] = await Promise.all([
      listProducts(),
      listStockMovements(),
      listCategories(),
      listProviders().catch(() => [] as ProviderResponseDTO[]),
      listClients().catch(() => [] as ClientResponseDTO[]),
    ]);
    const variantEntries = await Promise.all(
      products.map(async (product) => {
        const variants = await listProductVariants(product.id).catch(() => [] as ProductVariantResponseDTO[]);
        return [product.id, variants] as const;
      }),
    );
    return {
      products,
      variantsByProduct: Object.fromEntries(variantEntries),
      movements,
      categories,
      providers,
      clients,
    };
  }, []);

  const { data, loading, error, reload } = useCachedResource({
    key: 'screen.stocks',
    fetcher: fetchStockData,
    refreshSignal,
  });

  const loadStockData = useCallback(
    async (showLoader: boolean = true) => {
      await reload(showLoader ? 'blocking' : 'silent');
    },
    [reload],
  );
  const { refreshing, onRefresh } = usePullToRefresh(() => loadStockData(false));

  const products = data?.products ?? [];
  const variantsByProduct = data?.variantsByProduct ?? {};
  const movements = data?.movements ?? [];
  const categories = data?.categories ?? [];
  const providers = data?.providers ?? [];
  const clients = data?.clients ?? [];

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const aggregates = useMemo(
    () => products.map((product) => aggregateProduct(product, variantsByProduct[product.id] ?? [])),
    [products, variantsByProduct],
  );
  const aggregateByProductId = useMemo(
    () => new Map(aggregates.map((aggregate) => [aggregate.product.id, aggregate])),
    [aggregates],
  );

  const categoryOptions = useMemo<SearchableSelectOption[]>(
    () =>
      categories.map((category) => ({
        label: category.nom,
        value: category.id,
        subtitle: category.description,
      })),
    [categories],
  );
  const categoryFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [{ label: 'Toutes les categories', value: 'all' }, ...categoryOptions],
    [categoryOptions],
  );
  const productOptions = useMemo<SearchableSelectOption[]>(
    () =>
      aggregates.map((aggregate) => ({
        label: aggregate.product.name,
        value: aggregate.product.id,
        subtitle: `${aggregate.totalUnits} unite${aggregate.totalUnits > 1 ? 's' : ''} • ${aggregate.variants.length} variante${aggregate.variants.length > 1 ? 's' : ''}`,
        keywords: `${aggregate.product.brand ?? ''} ${aggregate.product.categoryName ?? ''}`,
      })),
    [aggregates],
  );
  const selectedMovementProduct = productById.get(movementProductId);
  const selectedMovementVariants = movementProductId ? variantsByProduct[movementProductId] ?? [] : [];
  const selectedMovementVariant = selectedMovementVariants.find((variant) => variant.id === movementVariantId);
  const movementVariantOptions = useMemo<SearchableSelectOption[]>(
    () =>
      selectedMovementVariants.map((variant) => ({
        label: variantLabel(variant),
        value: variant.id,
        subtitle: `Stock ${variant.quantity}${variant.consignedQuantity ? ` • Consigne ${variant.consignedQuantity}` : ''}`,
        keywords: `${variant.sku ?? ''} ${variant.barcode ?? ''}`,
      })),
    [selectedMovementVariants],
  );
  const providerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      providers.map((provider) => ({
        label: provider.name,
        value: provider.id,
        subtitle: provider.email ?? provider.phone,
      })),
    [providers],
  );
  const clientOptions = useMemo<SearchableSelectOption[]>(
    () => clients.map((client) => ({ label: client.name, value: client.id, subtitle: client.phone ?? client.email })),
    [clients],
  );

  const stockFilterOptions = useMemo<ChipOption[]>(
    () => [
      { label: 'Tous', value: 'all' },
      { label: 'Disponible', value: 'available' },
      { label: 'Stock bas', value: 'low' },
      { label: 'Rupture', value: 'zero' },
    ],
    [],
  );
  const movementTypeFilterOptions = useMemo<ChipOption[]>(
    () => [{ label: 'Tous', value: 'all' }, ...MOVEMENT_TYPE_OPTIONS],
    [],
  );
  const movementProductFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [{ label: 'Tous les produits', value: 'all' }, ...productOptions],
    [productOptions],
  );

  const filteredAggregates = useMemo(() => {
    const lower = productQuery.trim().toLowerCase();
    return aggregates.filter((aggregate) => {
      const product = aggregate.product;
      const variantBlob = aggregate.variants.map((variant) => variantLabel(variant)).join(' ');
      const blob = `${product.name} ${product.brand ?? ''} ${product.categoryName ?? ''} ${variantBlob}`.toLowerCase();
      const matchQuery = !lower || blob.includes(lower);
      const matchCategory = productCategoryFilter === 'all' || product.categoryId === productCategoryFilter;
      const matchStock =
        productStockFilter === 'all'
          ? true
          : productStockFilter === 'available'
            ? aggregate.totalUnits > 0
            : productStockFilter === 'low'
              ? aggregate.lowStockCount > 0
              : aggregate.totalUnits <= 0;
      return matchQuery && matchCategory && matchStock;
    });
  }, [aggregates, productCategoryFilter, productQuery, productStockFilter]);

  const filteredMovements = useMemo(() => {
    const lower = movementQuery.trim().toLowerCase();
    return movements
      .filter((movement) => {
        const product = productById.get(movement.productId);
        const variant = variantsByProduct[movement.productId]?.find((item) => item.id === movement.variantId);
        const serialNumbers = movement.serialNumbers?.join(' ') ?? '';
        const blob = `${product?.name ?? ''} ${variant ? variantLabel(variant) : ''} ${movement.type} ${movement.source ?? ''} ${movement.reason ?? ''} ${serialNumbers}`.toLowerCase();
        const matchQuery = !lower || blob.includes(lower);
        const matchType = movementTypeFilter === 'all' || movement.type === movementTypeFilter;
        const matchProduct = movementProductFilter === 'all' || movement.productId === movementProductFilter;
        return matchQuery && matchType && matchProduct;
      })
      .sort((left, right) => {
        const leftDate = left.date ? new Date(left.date).getTime() : 0;
        const rightDate = right.date ? new Date(right.date).getTime() : 0;
        return rightDate - leftDate;
      });
  }, [movementProductFilter, movementQuery, movementTypeFilter, movements, productById, variantsByProduct]);

  const productFilterCount =
    (productCategoryFilter === 'all' ? 0 : 1) + (productStockFilter === 'all' ? 0 : 1);
  const movementFilterCount =
    (movementProductFilter === 'all' ? 0 : 1) + (movementTypeFilter === 'all' ? 0 : 1);
  const showMovementSerialNumbers =
    selectedMovementProduct?.trackingMode === 'SERIAL' && acceptsSerialUnitCreation(movementType);
  const incomingMovement = movementType === 'ENTREE' || movementType === 'CONSIGNATION_ENTREE';

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const openEditProductModal = (product: ProductResponseDTO) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
  };

  const handleSaveProduct = async (payload: ProductRequestDTO) => {
    setSavingProduct(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        closeProductModal();
        await loadStockData(false);
        toast.success('Produit mis a jour.');
      } else {
        const created = await createProduct(payload);
        closeProductModal();
        await loadStockData(false);
        onSelectProduct?.(created.id);
        toast.success('Produit cree.');
      }
      onProductChanged?.();
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSavingProduct(false);
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
            await loadStockData(false);
            onProductChanged?.();
            toast.success('Produit supprime.');
          } catch (deleteError) {
            Alert.alert('Erreur', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const closeMovementModal = () => {
    setShowMovementModal(false);
    setMovementImeiScannerVisible(false);
    setMovementProductId('');
    setMovementVariantId('');
    setMovementQuantity('1');
    setMovementType('ENTREE');
    setMovementSource('');
    setMovementReason('');
    setMovementProviderId('');
    setMovementUnitPurchasePrice('');
    setMovementSerialNumbers('');
    setMovementClientId('');
    setMovementReference('');
  };

  const handleMovementProductChange = (productId: string) => {
    const variants = variantsByProduct[productId] ?? [];
    setMovementProductId(productId);
    setMovementVariantId(variants[0]?.id ?? '');
    setMovementSerialNumbers('');
  };

  const handleMovementImeiScan = async (code: string) => {
    setMovementImeiScannerVisible(false);
    const serial = normalizeSerialNumber(code);
    if (!serial) {
      return;
    }
    if (!showMovementSerialNumbers) {
      Alert.alert('Scan indisponible', 'Selectionnez un produit SERIAL et un type de mouvement entrant.');
      return;
    }

    const currentSerials = parseSerialNumbers(movementSerialNumbers);
    const alreadyEntered = currentSerials.some(
      (candidate) => candidate.toUpperCase() === serial.toUpperCase(),
    );
    if (alreadyEntered) {
      Alert.alert('Validation', 'Cet IMEI est deja saisi dans ce mouvement.');
      return;
    }

    try {
      const existingUnit = await getProductUnitBySerialNumber(serial);
      Alert.alert(
        'IMEI deja connu',
        `L'IMEI ${existingUnit.serialNumber} existe deja dans le stock. Une entree ne doit pas recreer une unite existante.`,
      );
      return;
    } catch {
      // Un 404 est le cas normal pour une nouvelle unite entrante.
    }

    const nextSerials = [...currentSerials, serial];
    setMovementSerialNumbers(nextSerials.join('\n'));

    const parsedQuantity = Number(movementQuantity.trim());
    const currentQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0
      ? Math.trunc(parsedQuantity)
      : 0;
    setMovementQuantity(String(Math.max(currentQuantity, nextSerials.length, 1)));
  };

  const handleCreateMovement = async () => {
    if (!movementProductId) {
      Alert.alert('Validation', 'Selectionnez un produit.');
      return;
    }
    if (!movementVariantId) {
      Alert.alert('Validation', 'Selectionnez une variante.');
      return;
    }
    const parsedQuantity = Number(movementQuantity.trim());
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || Math.trunc(parsedQuantity) !== parsedQuantity) {
      Alert.alert('Validation', 'La quantite doit etre un entier positif.');
      return;
    }
    const serialNumbers = parseSerialNumbers(movementSerialNumbers);
    const isSerialProduct = selectedMovementProduct?.trackingMode === 'SERIAL';
    if (movementType === 'CONSIGNATION_ENTREE' && !movementProviderId) {
      Alert.alert('Validation', 'Un fournisseur est obligatoire pour une entree en consignation.');
      return;
    }
    if (movementSource === 'RETOUR_CLIENT' && !movementClientId) {
      Alert.alert('Validation', 'Un client est obligatoire pour un retour client.');
      return;
    }
    if (movementSource === 'AJUSTEMENT' && !movementReason.trim()) {
      Alert.alert('Validation', 'Le motif est obligatoire pour un ajustement.');
      return;
    }
    if (isSerialProduct && !acceptsSerialUnitCreation(movementType)) {
      Alert.alert('Validation', 'Les sorties SERIAL doivent passer par une vente avec IMEI.');
      return;
    }
    if (isSerialProduct && serialNumbers.length !== Math.trunc(parsedQuantity)) {
      Alert.alert('Validation', 'Le nombre d IMEI doit correspondre exactement a la quantite.');
      return;
    }
    if (!isSerialProduct && serialNumbers.length > 0) {
      Alert.alert('Validation', 'Les IMEI sont reserves aux produits en mode IMEI.');
      return;
    }
    if (serialNumbers.length > 0 && new Set(serialNumbers).size !== serialNumbers.length) {
      Alert.alert('Validation', 'Un meme IMEI ne peut pas etre saisi plusieurs fois.');
      return;
    }
    const parsedPurchasePrice = movementUnitPurchasePrice.trim()
      ? Number(movementUnitPurchasePrice.replace(',', '.').trim())
      : undefined;
    if (parsedPurchasePrice !== undefined && (!Number.isFinite(parsedPurchasePrice) || parsedPurchasePrice < 0)) {
      Alert.alert('Validation', "Le prix d'achat doit etre positif ou vide.");
      return;
    }

    setSavingMovement(true);
    try {
      await createStockMovement({
        productId: movementProductId,
        variantId: movementVariantId,
        quantity: Math.trunc(parsedQuantity),
        type: movementType,
        source: movementSource || undefined,
        providerId: incomingMovement ? movementProviderId || undefined : undefined,
        unitPurchasePrice: incomingMovement ? parsedPurchasePrice : undefined,
        serialNumbers: isSerialProduct && acceptsSerialUnitCreation(movementType) ? serialNumbers : undefined,
        clientId: movementSource === 'RETOUR_CLIENT' ? movementClientId || undefined : undefined,
        reference: movementReference.trim() || undefined,
        reason: movementReason.trim() || undefined,
        date: new Date().toISOString(),
      });
      closeMovementModal();
      await loadStockData(false);
      onProductChanged?.();
      toast.success('Mouvement ajoute.');
    } catch (createError) {
      Alert.alert('Erreur', getErrorMessage(createError));
    } finally {
      setSavingMovement(false);
    }
  };

  if (loading) {
    return <SkeletonList />;
  }

  if (error) {
    return <ErrorState title='Erreur stock' message={error} onRetry={() => void loadStockData()} />;
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />}
      >
        <ScreenHeader title='Gestion de stock' subtitle='Modeles, variantes et mouvements' />

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
                placeholder='Rechercher un modele ou une variante...'
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
                  <Text style={styles.formLabel}>Stock</Text>
                  <ChipGroup
                    options={stockFilterOptions}
                    value={productStockFilter}
                    onChange={(value) => setProductStockFilter(value as 'all' | 'available' | 'low' | 'zero')}
                    layout='row-scroll'
                  />
                </View>
              </View>
            ) : null}

            {filteredAggregates.length === 0 ? (
              <EmptyState
                icon='package'
                title='Aucun produit'
                description='Ajoutez un modele ou modifiez la recherche.'
                actionLabel='Nouveau produit'
                onAction={openCreateProductModal}
              />
            ) : (
              <View style={styles.list}>
                {filteredAggregates.map((aggregate) => (
                  <ProductCard
                    key={aggregate.product.id}
                    aggregate={aggregate}
                    fmtCurrency={fmtCurrency}
                    onOpen={() => onSelectProduct?.(aggregate.product.id)}
                    onEdit={() => openEditProductModal(aggregate.product)}
                    onDelete={() => handleDeleteProduct(aggregate.product)}
                  />
                ))}
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
                  <Text style={styles.formLabel}>Type</Text>
                  <ChipGroup
                    options={movementTypeFilterOptions}
                    value={movementTypeFilter}
                    onChange={(value) => setMovementTypeFilter(value as 'all' | MovementType)}
                    layout='row-scroll'
                  />
                </View>
              </View>
            ) : null}

            {filteredMovements.length === 0 ? (
              <EmptyState
                icon='repeat'
                title='Aucun mouvement'
                description='Ajoutez votre premier mouvement de stock.'
                actionLabel='Nouveau mouvement'
                onAction={() => setShowMovementModal(true)}
              />
            ) : (
              <View style={styles.list}>
                {filteredMovements.map((movement) => {
                  const visual = movementVisual(movement.type);
                  const product = productById.get(movement.productId);
                  const variant = variantsByProduct[movement.productId]?.find((item) => item.id === movement.variantId);
                  return (
                    <View key={movement.id} style={styles.card}>
                      <View style={styles.movementHeader}>
                        <View style={[styles.iconBubble, { backgroundColor: visual.background }]}>
                          <Feather name={visual.icon} size={18} color={visual.color} />
                        </View>
                        <View style={styles.movementText}>
                          <Text style={styles.productName}>{product?.name ?? movement.productId}</Text>
                          <Text style={styles.productMeta}>
                            {variant ? variantLabel(variant) : movement.variantId} • {movement.type}
                          </Text>
                          {movement.serialNumbers?.length ? (
                            <Text style={styles.productMeta}>IMEI : {movement.serialNumbers.join(', ')}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.movementQty}>
                          {visual.sign}
                          {movement.quantity}
                        </Text>
                      </View>
                      <Text style={styles.gridLabel}>{formatDate(movement.date)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ProductFormModal
        visible={showProductModal}
        product={editingProduct}
        categories={categories}
        saving={savingProduct}
        onClose={closeProductModal}
        onSubmit={handleSaveProduct}
      />

      <FormModal visible={showMovementModal} title='Nouveau mouvement' onClose={closeMovementModal}>
        <SearchableSelectField
          label='Produit'
          modalTitle='Selectionner un produit'
          placeholder='Choisir un produit'
          value={movementProductId}
          options={productOptions}
          onChange={handleMovementProductChange}
          disabled={products.length === 0}
        />

        <SearchableSelectField
          label='Variante'
          modalTitle='Selectionner une variante'
          placeholder={movementProductId ? 'Choisir une variante' : 'Choisissez d abord un produit'}
          value={movementVariantId}
          options={movementVariantOptions}
          onChange={(value) => {
            setMovementVariantId(value);
            setMovementSerialNumbers('');
          }}
          disabled={!movementProductId || movementVariantOptions.length === 0}
          emptyMessage='Aucune variante pour ce produit.'
        />

        {selectedMovementVariant ? (
          <Text style={styles.helperText}>
            Stock {selectedMovementVariant.quantity}
            {selectedMovementVariant.consignedQuantity ? ` • Consigne ${selectedMovementVariant.consignedQuantity}` : ''}
          </Text>
        ) : null}

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Type</Text>
          <ChipGroup
            options={MOVEMENT_TYPE_OPTIONS}
            value={movementType}
            onChange={(value) => {
              const nextType = value as MovementType;
              setMovementType(nextType);
              if (!acceptsSerialUnitCreation(nextType)) {
                setMovementSerialNumbers('');
              }
            }}
            layout='wrap'
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Source</Text>
          <ChipGroup
            options={MOVEMENT_SOURCE_OPTIONS}
            value={movementSource}
            onChange={(value) => setMovementSource(value as MovementSource | '')}
            layout='row-scroll'
          />
        </View>

        <InputField
          label='Quantite'
          value={movementQuantity}
          onChangeText={setMovementQuantity}
          placeholder='1'
          keyboardType='numeric'
        />

        {showMovementSerialNumbers ? (
          <View style={styles.imeiSection}>
            <View style={styles.imeiHeader}>
              <View style={styles.imeiHeaderText}>
                <Text style={styles.formLabel}>IMEI / numeros de serie</Text>
                <Text style={styles.helperText}>Renseignez exactement {movementQuantity || '0'} IMEI.</Text>
              </View>
              <Pressable
                style={styles.imeiScanButton}
                onPress={() => setMovementImeiScannerVisible(true)}
                hitSlop={8}
              >
                <Feather name='camera' size={18} color={colors.white} />
                <Text style={styles.imeiScanText}>Scanner</Text>
              </Pressable>
            </View>
            <TextInput
              value={movementSerialNumbers}
              onChangeText={setMovementSerialNumbers}
              placeholder='Un IMEI par ligne'
              placeholderTextColor={colors.neutral400}
              multiline
              autoCapitalize='characters'
              autoCorrect={false}
              style={styles.imeiTextarea}
            />
            <Text style={styles.helperText}>
              {parseSerialNumbers(movementSerialNumbers).length} IMEI saisi
              {parseSerialNumbers(movementSerialNumbers).length > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}

        {incomingMovement ? (
          <>
            <SearchableSelectField
              label={movementType === 'CONSIGNATION_ENTREE' ? 'Fournisseur obligatoire' : 'Fournisseur'}
              modalTitle='Selectionner un fournisseur'
              placeholder={providers.length === 0 ? 'Aucun fournisseur' : 'Choisir un fournisseur'}
              value={movementProviderId}
              options={providerOptions}
              onChange={setMovementProviderId}
              disabled={providers.length === 0}
            />
            <MoneyInput
              label="Prix d'achat unitaire"
              value={movementUnitPurchasePrice}
              onChangeText={setMovementUnitPurchasePrice}
              placeholder='Optionnel'
            />
          </>
        ) : null}

        {movementSource === 'RETOUR_CLIENT' ? (
          <SearchableSelectField
            label='Client'
            modalTitle='Selectionner un client'
            placeholder={clients.length === 0 ? 'Aucun client' : 'Choisir un client'}
            value={movementClientId}
            options={clientOptions}
            onChange={setMovementClientId}
            disabled={clients.length === 0}
          />
        ) : null}

        <InputField
          label='Reference'
          value={movementReference}
          onChangeText={setMovementReference}
          placeholder='BL, commande, retour'
        />
        <InputField
          label={movementSource === 'AJUSTEMENT' ? 'Motif obligatoire' : 'Motif'}
          value={movementReason}
          onChangeText={setMovementReason}
          placeholder='Ex: inventaire'
        />

        <View style={styles.modalActions}>
          <View style={styles.actionItem}>
            <AppButton label='Retour' variant='outline' onPress={closeMovementModal} disabled={savingMovement} />
          </View>
          <View style={styles.actionItem}>
            <AppButton
              label={savingMovement ? 'Creation...' : 'Ajouter'}
              onPress={() => {
                void handleCreateMovement();
              }}
              disabled={savingMovement}
              loading={savingMovement}
            />
          </View>
        </View>
      </FormModal>

      <BarcodeScanner
        visible={movementImeiScannerVisible}
        expect='imei'
        hint="Visez l'IMEI de l'article a entrer en stock"
        onClose={() => setMovementImeiScannerVisible(false)}
        onScan={(code) => {
          void handleMovementImeiScan(code);
        }}
      />

    </View>
  );
}

function ProductCard({
  aggregate,
  fmtCurrency,
  onOpen,
  onEdit,
  onDelete,
}: {
  aggregate: ProductAggregate;
  fmtCurrency: (value: number) => string;
  onOpen?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { product, variants, quantity, consignedQuantity, totalUnits, lowStockCount } = aggregate;
  const preview = variants.slice(0, 3).map(variantLabel).join(' • ');
  return (
    <Pressable style={styles.card} onPress={onOpen} disabled={!onOpen}>
      <View style={styles.productHeader}>
        <View style={styles.productTitleWrap}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productMeta}>
            {[product.brand, product.categoryName].filter(Boolean).join(' • ') || 'Sans categorie'}
          </Text>
        </View>
        <View style={styles.actionsWrap}>
          {product.trackingMode === 'SERIAL' ? <Badge label='IMEI' tone='info' /> : <Badge label='Standard' tone='neutral' />}
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            hitSlop={8}
          >
            <Feather name='edit-2' size={18} color={colors.neutral600} />
          </Pressable>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            hitSlop={8}
          >
            <Feather name='trash-2' size={18} color={colors.danger600} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.productPrice}>{product.price != null ? fmtCurrency(product.price) : '-'}</Text>
      <Text style={styles.productMeta}>
        {totalUnits} unite{totalUnits > 1 ? 's' : ''} sur {variants.length} variante{variants.length > 1 ? 's' : ''}
      </Text>
      {preview ? <Text style={styles.productMeta}>{preview}</Text> : null}

      <View style={styles.cardGrid}>
        <Metric label='Stock' value={String(quantity)} />
        <Metric label='Consigne' value={String(consignedQuantity)} />
        <Metric label='Alertes' value={String(lowStockCount)} danger={lowStockCount > 0} />
      </View>
    </Pressable>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={[styles.metricBlock, danger && styles.metricDanger]}>
      <Text style={styles.gridLabel}>{label}</Text>
      <Text style={styles.gridValue}>{value}</Text>
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: 'neutral' | 'info' }) {
  return (
    <View style={[styles.badge, tone === 'info' ? styles.badgeInfo : styles.badgeNeutral]}>
      <Text style={styles.badgeText}>{label}</Text>
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
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 14,
  },
  topAction: {
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchField: {
    flex: 1,
  },
  filterButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.danger500,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    ...typography.caption,
    color: colors.white,
  },
  filtersPanel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radius.md,
    padding: 12,
    gap: 12,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    ...typography.label,
    color: colors.neutral700,
  },
  helperText: {
    ...typography.caption,
    color: colors.neutral500,
  },
  imeiSection: {
    gap: 8,
  },
  imeiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  imeiHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  imeiScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.neutral900,
  },
  imeiScanText: {
    ...typography.label,
    color: colors.white,
  },
  imeiTextarea: {
    ...typography.body,
    minHeight: 104,
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.neutral900,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 14,
    gap: 10,
    ...shadows.sm,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  productTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  productMeta: {
    ...typography.caption,
    color: colors.neutral500,
  },
  productPrice: {
    ...typography.bodyMedium,
    color: colors.neutral800,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeNeutral: {
    backgroundColor: colors.neutral100,
  },
  badgeInfo: {
    backgroundColor: colors.primary100,
  },
  badgeText: {
    ...typography.caption,
    color: colors.neutral800,
  },
  cardGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricBlock: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.neutral50,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 10,
  },
  metricDanger: {
    backgroundColor: colors.danger100,
    borderColor: colors.danger100,
  },
  gridLabel: {
    ...typography.caption,
    color: colors.neutral500,
  },
  gridValue: {
    ...typography.bodyMedium,
    color: colors.neutral900,
    marginTop: 2,
  },
  movementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movementText: {
    flex: 1,
    minWidth: 0,
  },
  movementQty: {
    ...typography.h2,
    color: colors.neutral900,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionItem: {
    flex: 1,
  },
});
