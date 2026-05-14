import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  createProduct,
  createProductVariant,
  createStockMovement,
  deleteProduct,
  deleteProductVariant,
  getProductByBarcode,
  listCategories,
  listClients,
  listProductUnits,
  listProducts,
  listProductVariants,
  listProviders,
  listStockMovements,
  updateProduct,
  updateProductUnitStatus,
} from '../api/services';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { getErrorMessage } from '../api/errors';
import { useFormatCurrency } from '../context/AppSettingsContext';
import { formatDate } from '../utils/format';
import type {
  CategoryResponseDTO,
  ClientResponseDTO,
  MovementSource,
  MovementType,
  ProductResponseDTO,
  ProductUnitResponseDTO,
  ProductUnitStatus,
  ProductVariantResponseDTO,
  ProviderResponseDTO,
  StockMovementResponseDTO,
  TrackingMode,
} from '../types/api';

const PRODUCT_UNIT_STATUS_LABELS: Record<ProductUnitStatus, string> = {
  IN_STOCK: 'En stock',
  SOLD: 'Vendu',
  RETURNED: 'Retourné',
  DAMAGED: 'Endommagé',
  LOST: 'Perdu',
};

const PRODUCT_UNIT_STATUS_COLORS: Record<ProductUnitStatus, string> = {
  IN_STOCK: '#16a34a',
  SOLD: '#2563eb',
  RETURNED: '#f59e0b',
  DAMAGED: '#dc2626',
  LOST: '#6b7280',
};
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { AppButton } from '../components/common/AppButton';
import { ChipGroup, type ChipOption } from '../components/common/ChipGroup';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { FormModal } from '../components/common/FormModal';
import { ImeiInput } from '../components/common/ImeiInput';
import { InputField } from '../components/common/InputField';
import { LoadingState } from '../components/common/LoadingState';
import { SearchableSelectField, type SearchableSelectOption } from '../components/common/SearchableSelectField';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SearchField } from '../components/common/SearchField';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { useCachedResource } from '../hooks/useCachedResource';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface StocksScreenProps {
  refreshSignal: number;
  onProductChanged?: () => void;
  /** Si fourni : tap sur une card produit (ou scan code-barres réussi)
   *  ouvre l'écran ProductDetail. Sans cette prop, les cards restent
   *  passives — utile pour les contextes où la consultation n'a pas de sens. */
  onSelectProduct?: (productId: string) => void;
}

interface ComputedStock {
  available: number;
  consigned: number;
}

interface StockScreenData {
  products: ProductResponseDTO[];
  movements: StockMovementResponseDTO[];
  categories: CategoryResponseDTO[];
  providers: ProviderResponseDTO[];
  clients: ClientResponseDTO[];
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

function acceptsSerialUnitCreation(type: MovementType): boolean {
  return type === 'ENTREE' || type === 'CONSIGNATION_ENTREE' || type === 'PRODUCTION';
}

function parseSerialNumbers(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function StocksScreen({ refreshSignal, onProductChanged, onSelectProduct }: StocksScreenProps) {
  const fmtCurrency = useFormatCurrency();
  const [activeTab, setActiveTab] = useState<'produits' | 'mouvements'>('produits');
  const [productQuery, setProductQuery] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerLookupInProgress, setScannerLookupInProgress] = useState(false);
  const [movementQuery, setMovementQuery] = useState('');
  const [showProductFilters, setShowProductFilters] = useState(false);
  const [showMovementFilters, setShowMovementFilters] = useState(false);
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'available' | 'low' | 'zero'>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | MovementType>('all');
  const [movementProductFilter, setMovementProductFilter] = useState('all');

  const [saving, setSaving] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategoryId, setProductCategoryId] = useState('');
  const [productTrackingMode, setProductTrackingMode] = useState<TrackingMode>('NONE');
  // Consignation : on cocheable à la création/édition pour signaler que ce
  // produit est habituellement pris chez un fournisseur. providerId devient
  // obligatoire dès lors. providerPrice est le prix d'achat de référence.
  const [productConsignment, setProductConsignment] = useState(false);
  const [productProviderId, setProductProviderId] = useState('');
  const [productProviderPrice, setProductProviderPrice] = useState('');

  // Variantes (visibles uniquement en mode édition d'un produit existant)
  const [productVariants, setProductVariants] = useState<ProductVariantResponseDTO[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('');

  // Unités physiques (visibles uniquement en édition d'un produit SERIAL)
  const [productUnits, setProductUnits] = useState<ProductUnitResponseDTO[]>([]);
  const [loadingProductUnits, setLoadingProductUnits] = useState(false);
  const [unitStatusFilter, setUnitStatusFilter] = useState<'all' | ProductUnitStatus>('all');

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementProductId, setMovementProductId] = useState('');
  const [movementQuantity, setMovementQuantity] = useState('1');
  const [movementType, setMovementType] = useState<MovementType>('ENTREE');
  const [movementSource, setMovementSource] = useState<MovementSource | ''>('');
  const [movementReason, setMovementReason] = useState('');
  /** Fournisseur (visible si ENTREE/CONSIGNATION_ENTREE ; obligatoire pour CONSIGNATION_ENTREE). */
  const [movementProviderId, setMovementProviderId] = useState('');
  const [movementUnitPurchasePrice, setMovementUnitPurchasePrice] = useState('');
  const [movementSerialNumbers, setMovementSerialNumbers] = useState('');
  /** Client (visible/obligatoire si source RETOUR_CLIENT). */
  const [movementClientId, setMovementClientId] = useState('');
  /** Référence libre (n° BL fournisseur, n° commande, n° retour). */
  const [movementReference, setMovementReference] = useState('');

  const fetchStockData = useCallback(async (): Promise<StockScreenData> => {
    const [fetchedProducts, fetchedMovements, fetchedCategories, fetchedProviders, fetchedClients] =
      await Promise.all([
        listProducts(),
        listStockMovements(),
        listCategories(),
        listProviders().catch(() => [] as ProviderResponseDTO[]),
        listClients().catch(() => [] as ClientResponseDTO[]),
      ]);
    return {
      products: fetchedProducts,
      movements: fetchedMovements,
      categories: fetchedCategories,
      providers: fetchedProviders,
      clients: fetchedClients,
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
    [reload]
  );
  const { refreshing, onRefresh } = usePullToRefresh(() => loadStockData(false));

  const products = data?.products ?? [];
  const movements = data?.movements ?? [];
  const categories = data?.categories ?? [];
  const providers = data?.providers ?? [];
  const clients = data?.clients ?? [];

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const namedProductVariants = useMemo(
    () => productVariants.filter((variant) => variant.name && variant.name.trim().length > 0),
    [productVariants]
  );

  const categoryOptions = useMemo<SearchableSelectOption[]>(
    () =>
      categories.map((category) => ({
        label: category.nom,
        value: category.id,
        subtitle: category.description,
      })),
    [categories]
  );
  const providerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      providers.map((provider) => ({
        label: provider.name,
        value: provider.id,
        subtitle: provider.email ?? provider.phone,
      })),
    [providers]
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
      const serialNumbers = movement.serialNumbers?.join(' ') ?? '';
      const blob = `${productName} ${movement.type} ${movement.source ?? ''} ${movement.reason ?? ''} ${serialNumbers}`.toLowerCase();
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

  const loadProductVariants = useCallback(async (productId: string) => {
    setLoadingVariants(true);
    setVariantError(null);
    try {
      const variants = await listProductVariants(productId);
      setProductVariants(variants);
    } catch (variantLoadError) {
      setProductVariants([]);
      setVariantError(getErrorMessage(variantLoadError));
    } finally {
      setLoadingVariants(false);
    }
  }, []);

  const loadProductUnits = useCallback(async (productId: string) => {
    setLoadingProductUnits(true);
    try {
      const units = await listProductUnits({ productId });
      setProductUnits(units);
    } catch {
      setProductUnits([]);
    } finally {
      setLoadingProductUnits(false);
    }
  }, []);

  const resetVariantForm = () => {
    setNewVariantName('');
    setNewVariantPrice('');
    setNewVariantStock('');
  };

  const openCreateProductModal = () => {
    setEditingProductId(null);
    setProductName('');
    setProductBrand('');
    setProductPrice('');
    setProductCategoryId(categories[0]?.id ?? '');
    setProductTrackingMode('NONE');
    setProductConsignment(false);
    setProductProviderId('');
    setProductProviderPrice('');
    setProductVariants([]);
    setVariantError(null);
    resetVariantForm();
    setShowProductModal(true);
  };

  /**
   * Lookup serveur après scan code-barres : ouvre la fiche produit si trouvé,
   * sinon Alert. {@code scannerLookupInProgress} évite les double-clics
   * pendant la requête réseau.
   */
  const handleBarcodeScanned = useCallback(
    async (code: string) => {
      if (scannerLookupInProgress) {
        return;
      }
      if (!onSelectProduct) {
        Alert.alert('Indisponible', 'La consultation produit n est pas accessible depuis cette vue.');
        return;
      }
      setScannerLookupInProgress(true);
      try {
        const product = await getProductByBarcode(code);
        onSelectProduct(product.id);
      } catch (lookupError) {
        const message = getErrorMessage(lookupError);
        Alert.alert(
          'Produit introuvable',
          `Aucun produit avec le code "${code}".\n${message}`,
        );
      } finally {
        setScannerLookupInProgress(false);
      }
    },
    [onSelectProduct, scannerLookupInProgress],
  );

  const openEditProductModal = (product: ProductResponseDTO) => {
    setEditingProductId(product.id);
    setProductName(product.name);
    setProductBrand(product.brand ?? '');
    setProductPrice(product.price != null ? String(product.price) : '');
    setProductCategoryId(product.categoryId ?? categories[0]?.id ?? '');
    setProductTrackingMode(product.trackingMode ?? 'NONE');
    setProductConsignment(Boolean(product.consignment));
    setProductProviderId(product.providerId ?? '');
    setProductProviderPrice(product.providerPrice != null ? String(product.providerPrice) : '');
    setProductVariants([]);
    setProductUnits([]);
    setUnitStatusFilter('all');
    setVariantError(null);
    resetVariantForm();
    setShowProductModal(true);
    void loadProductVariants(product.id);
    if (product.trackingMode === 'SERIAL') {
      void loadProductUnits(product.id);
    }
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProductId(null);
    setProductName('');
    setProductBrand('');
    setProductPrice('');
    setProductCategoryId('');
    setProductTrackingMode('NONE');
    setProductConsignment(false);
    setProductProviderId('');
    setProductProviderPrice('');
    setProductVariants([]);
    setProductUnits([]);
    setUnitStatusFilter('all');
    setSavingVariant(false);
    setVariantError(null);
    resetVariantForm();
  };

  const askChangeUnitStatus = (unit: ProductUnitResponseDTO) => {
    if (!editingProductId) return;
    // Le statut SOLD est interdit ici (réservé au flux vente).
    const allTransitions: Array<{ label: string; status: ProductUnitStatus; destructive?: boolean }> = [
      { label: 'Remettre en stock', status: 'IN_STOCK' },
      { label: 'Retourné par client', status: 'RETURNED' },
      { label: 'Endommagé', status: 'DAMAGED', destructive: true },
      { label: 'Perdu / Volé', status: 'LOST', destructive: true },
    ];
    const available = allTransitions.filter((t) => t.status !== unit.status);

    Alert.alert(
      `IMEI ${unit.serialNumber}`,
      `Statut actuel : ${PRODUCT_UNIT_STATUS_LABELS[unit.status]}`,
      [
        ...available.map((t) => ({
          text: t.label,
          style: t.destructive ? ('destructive' as const) : ('default' as const),
          onPress: () => applyUnitStatusChange(unit, t.status),
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ],
    );
  };

  const applyUnitStatusChange = async (unit: ProductUnitResponseDTO, newStatus: ProductUnitStatus) => {
    if (!editingProductId) return;
    try {
      await updateProductUnitStatus(unit.id, { status: newStatus });
      await loadProductUnits(editingProductId);
      onProductChanged?.();
    } catch (statusError) {
      Alert.alert('Erreur', getErrorMessage(statusError));
    }
  };

  const handleAddVariant = async () => {
    if (savingVariant) {
      return;
    }
    if (!editingProductId) {
      Alert.alert(
        'Action impossible',
        "Sauvegardez d'abord le produit (bouton 'Ajouter') avant de creer des variantes."
      );
      return;
    }
    const trimmedName = newVariantName.trim();
    if (!trimmedName) {
      Alert.alert('Validation', 'Le nom de la variante est obligatoire (ex: "Noir 256Go").');
      return;
    }
    const parsedPrice = newVariantPrice.trim()
      ? Number(newVariantPrice.replace(',', '.').trim())
      : undefined;
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      Alert.alert('Validation', 'Le prix doit etre un nombre positif ou vide.');
      return;
    }
    const parsedStock = newVariantStock.trim()
      ? Math.trunc(Number(newVariantStock.trim()))
      : 0;
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      Alert.alert('Validation', 'Le stock initial doit etre un entier positif ou zero.');
      return;
    }

    setSavingVariant(true);
    setVariantError(null);
    try {
      await createProductVariant(editingProductId, {
        name: trimmedName,
        price: parsedPrice,
        stock: parsedStock,
      });
      resetVariantForm();
      await loadProductVariants(editingProductId);
      onProductChanged?.();
    } catch (addError) {
      const message = getErrorMessage(addError);
      setVariantError(message);
      Alert.alert('Erreur', message);
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeleteVariant = (variant: ProductVariantResponseDTO) => {
    if (!editingProductId) return;
    Alert.alert('Supprimer variante', `Supprimer "${variant.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProductVariant(editingProductId, variant.id);
            await loadProductVariants(editingProductId);
            onProductChanged?.();
          } catch (deleteError) {
            Alert.alert('Erreur', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const closeMovementModal = () => {
    setShowMovementModal(false);
    setMovementProductId('');
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

    // Validation consignation : un produit consigné doit obligatoirement
    // pointer un fournisseur — le backend le rejette aussi mais on évite
    // un aller-retour et on donne un message localisé.
    if (productConsignment && !productProviderId) {
      Alert.alert(
        'Validation',
        'Un produit consigne doit etre lie a un fournisseur. Selectionnez un fournisseur ou decochez "consigne".',
      );
      return;
    }
    let parsedProviderPrice: number | undefined;
    if (productProviderPrice.trim()) {
      const value = Number(productProviderPrice.replace(',', '.').trim());
      if (!Number.isFinite(value) || value < 0) {
        Alert.alert('Validation', "Le prix d'achat fournisseur doit etre un nombre positif ou nul.");
        return;
      }
      parsedProviderPrice = value;
    }

    setSaving(true);
    try {
      const payload = {
        name: productName.trim(),
        brand: productBrand.trim() || undefined,
        price: parsedPrice,
        categoryId: productCategoryId,
        trackingMode: productTrackingMode,
        consignment: productConsignment,
        providerId: productConsignment ? productProviderId : undefined,
        providerPrice: parsedProviderPrice,
      };

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
      } else {
        await createProduct(payload);
      }

      closeProductModal();
      await loadStockData(false);
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
            await loadStockData(false);
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
    if (Math.trunc(parsedQuantity) !== parsedQuantity) {
      Alert.alert('Validation', 'La quantite doit etre un entier positif.');
      return;
    }
    const isIncomingMovement = movementType === 'ENTREE' || movementType === 'CONSIGNATION_ENTREE';
    const acceptsSerialNumbers = acceptsSerialUnitCreation(movementType);
    const selectedMovementProduct = productById.get(movementProductId);
    const isSerialProduct = selectedMovementProduct?.trackingMode === 'SERIAL';
    const serialNumbers = parseSerialNumbers(movementSerialNumbers);
    const normalizedPurchasePrice = movementUnitPurchasePrice.replace(',', '.').trim();
    const parsedPurchasePrice = normalizedPurchasePrice ? Number(normalizedPurchasePrice) : undefined;
    if (
      isIncomingMovement
      && parsedPurchasePrice !== undefined
      && (!Number.isFinite(parsedPurchasePrice) || parsedPurchasePrice < 0)
    ) {
      Alert.alert('Validation', "Le prix d'achat unitaire doit etre un nombre positif ou vide.");
      return;
    }

    // Règles métier (mirroir de StockMovementService côté backend) — validation côté UI
    // pour feedback immédiat ; le backend reste la source de vérité.
    if (movementType === 'CONSIGNATION_ENTREE' && !movementProviderId) {
      Alert.alert('Validation', 'Un fournisseur est obligatoire pour une entrée en consignation.');
      return;
    }
    if (movementSource === 'RETOUR_CLIENT' && !movementClientId) {
      Alert.alert('Validation', 'Un client est obligatoire pour un retour client.');
      return;
    }
    if (movementSource === 'AJUSTEMENT' && !movementReason.trim()) {
      Alert.alert('Validation', 'Le motif est obligatoire pour un ajustement de stock.');
      return;
    }
    if (isSerialProduct && !acceptsSerialNumbers) {
      Alert.alert('Validation', 'Les sorties de produits SERIAL doivent etre faites depuis une vente.');
      return;
    }
    if (isSerialProduct && acceptsSerialNumbers && serialNumbers.length !== Math.trunc(parsedQuantity)) {
      Alert.alert('Validation', 'Le nombre d IMEI doit correspondre exactement a la quantite entree.');
      return;
    }
    if (serialNumbers.length > 0 && new Set(serialNumbers).size !== serialNumbers.length) {
      Alert.alert('Validation', 'Un meme IMEI ne peut pas etre saisi plusieurs fois.');
      return;
    }
    if (!isSerialProduct && serialNumbers.length > 0) {
      Alert.alert('Validation', 'Les IMEI sont reserves aux produits configures avec suivi SERIAL.');
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
        providerId: isIncomingMovement ? movementProviderId || undefined : undefined,
        unitPurchasePrice: isIncomingMovement ? parsedPurchasePrice : undefined,
        serialNumbers: isSerialProduct && acceptsSerialNumbers ? serialNumbers : undefined,
        clientId: movementSource === 'RETOUR_CLIENT' ? movementClientId || undefined : undefined,
        reference: movementReference.trim() || undefined,
        date: new Date().toISOString(),
      });

      closeMovementModal();
      await loadStockData(false);
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

  const selectedMovementProduct = productById.get(movementProductId);
  const showMovementSerialNumbers =
    selectedMovementProduct?.trackingMode === 'SERIAL' && acceptsSerialUnitCreation(movementType);

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
              {onSelectProduct ? (
                <Pressable
                  style={styles.scanIconButton}
                  onPress={() => setScannerVisible(true)}
                  accessibilityLabel='Scanner un code-barres pour ouvrir un produit'
                  hitSlop={6}
                >
                  <Feather name='maximize' size={18} color={colors.neutral700} />
                </Pressable>
              ) : null}
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
                  // Card cliquable si la consultation produit est branchée
                  // (App.tsx fournit onSelectProduct). Les boutons edit/delete
                  // restent imbriqués : leur Pressable absorbe le tap avant
                  // que la card parente ne le voie.
                  const cardContent = (
                    <View style={styles.card}>
                      <View style={styles.productHeader}>
                        <View style={styles.productTitleWrap}>
                          <Text style={styles.productName}>{product.name}</Text>
                          <Text style={styles.productPrice}>
                            {product.price != null ? fmtCurrency(product.price) : '-'}
                          </Text>
                        </View>
                        <View style={styles.actionsWrap}>
                          <Pressable onPress={() => openEditProductModal(product)} hitSlop={6}>
                            <Feather name='edit-2' size={18} color={colors.neutral600} />
                          </Pressable>
                          <Pressable onPress={() => handleDeleteProduct(product)} hitSlop={6}>
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
                  return onSelectProduct ? (
                    <Pressable key={product.id} onPress={() => onSelectProduct(product.id)}>
                      {cardContent}
                    </Pressable>
                  ) : (
                    <View key={product.id}>{cardContent}</View>
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
                  const serialSummary = movement.serialNumbers?.length
                    ? `IMEI: ${movement.serialNumbers.join(', ')}`
                    : null;

                  return (
                    <View key={movement.id} style={styles.card}>
                      <View style={styles.movementHeader}>
                        <View style={[styles.iconBubble, { backgroundColor: visual.background }]}>
                          <Feather name={visual.icon} size={18} color={visual.color} />
                        </View>

                        <View style={styles.movementText}>
                          <Text style={styles.productName}>{productName}</Text>
                          <Text style={styles.productMeta}>{movement.reason || movement.source || '-'}</Text>
                          {serialSummary ? <Text style={styles.productMeta}>{serialSummary}</Text> : null}
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
          label='Marque (optionnel)'
          value={productBrand}
          onChangeText={setProductBrand}
          placeholder='Ex: Apple, Samsung, Nestle'
          autoCapitalize='words'
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

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Type de produit</Text>
          <SegmentedControl
            options={[
              { label: 'Standard', value: 'NONE' },
              { label: 'Avec n° de serie', value: 'SERIAL' },
            ]}
            value={productTrackingMode}
            onChange={(value) => setProductTrackingMode(value as TrackingMode)}
          />
          <Text style={styles.helperText}>
            {productTrackingMode === 'SERIAL'
              ? 'Chaque unite sera identifiee par un IMEI / numero de serie (telephones, ordinateurs).'
              : 'Stock fongible en quantite (sacs de riz, chargeurs, vitres).'}
          </Text>
        </View>

        <View style={styles.formGroup}>
          <View style={styles.consignmentToggleRow}>
            <View style={styles.consignmentToggleLabelWrap}>
              <Text style={styles.formLabel}>Produit consigne chez un fournisseur</Text>
              <Text style={styles.helperText}>
                Active si tu vends ce produit pour le compte d&apos;un fournisseur. Tu lui dois le prix d&apos;achat a chaque vente.
              </Text>
            </View>
            <Switch
              value={productConsignment}
              onValueChange={(next) => {
                setProductConsignment(next);
                if (!next) {
                  setProductProviderId('');
                  setProductProviderPrice('');
                }
              }}
              trackColor={{ false: colors.neutral300, true: colors.primary600 }}
              thumbColor={colors.white}
            />
          </View>

          {productConsignment ? (
            <View style={styles.consignmentDetails}>
              <SearchableSelectField
                label='Fournisseur'
                modalTitle='Selectionner un fournisseur'
                placeholder='Choisir le fournisseur'
                value={productProviderId}
                options={providerOptions}
                onChange={setProductProviderId}
                disabled={providers.length === 0}
              />
              {providers.length === 0 ? (
                <Text style={styles.helperText}>
                  Aucun fournisseur enregistre. Cree-en un dans l&apos;onglet Fournisseurs.
                </Text>
              ) : null}

              <InputField
                label="Prix d'achat fournisseur"
                value={productProviderPrice}
                onChangeText={setProductProviderPrice}
                placeholder='Ex: 1200'
                keyboardType='numeric'
              />
            </View>
          ) : null}
        </View>

        {editingProductId ? (
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Variantes (couleur, stockage, ...)</Text>
            <Text style={styles.helperText}>
              Optionnel. Une variante par defaut est gardee automatiquement.
              Ajoutez ici les variantes nommees (ex: &quot;Noir 256Go&quot;, &quot;Bleu 128Go&quot;).
            </Text>

            {variantError ? (
              <View style={styles.variantErrorBox}>
                <Text style={styles.variantErrorText}>{variantError}</Text>
              </View>
            ) : null}

            {loadingVariants ? (
              <Text style={styles.helperText}>Chargement...</Text>
            ) : namedProductVariants.length === 0 ? (
              <Text style={styles.helperText}>Aucune variante nommee pour le moment.</Text>
            ) : (
              <View style={styles.variantList}>
                {namedProductVariants.map((variant) => (
                    <View key={variant.id} style={styles.variantRow}>
                      <View style={styles.variantRowMain}>
                        <Text style={styles.variantName}>{variant.name}</Text>
                        <Text style={styles.variantMeta}>
                          {variant.price != null
                            ? `${fmtCurrency(variant.price)} • Stock ${variant.stock}`
                            : `Stock ${variant.stock}`}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteVariant(variant)}
                        disabled={savingVariant}
                        hitSlop={10}
                      >
                        <Feather name='trash-2' size={18} color={colors.danger600} />
                      </Pressable>
                    </View>
                  ))}
              </View>
            )}

            <View style={styles.variantAddBlock}>
              <InputField
                label='Nouvelle variante'
                value={newVariantName}
                onChangeText={setNewVariantName}
                placeholder='Ex: Noir 256Go'
              />
              <View style={styles.row}>
                <InputField
                  label='Prix (optionnel)'
                  value={newVariantPrice}
                  onChangeText={setNewVariantPrice}
                  placeholder='Ex: 850'
                  keyboardType='decimal-pad'
                  containerStyle={styles.flexHalf}
                />
                <InputField
                  label='Stock initial'
                  value={newVariantStock}
                  onChangeText={setNewVariantStock}
                  placeholder='0'
                  keyboardType='numeric'
                  containerStyle={styles.flexHalf}
                />
              </View>
              <AppButton
                label={savingVariant ? 'Ajout...' : 'Ajouter cette variante'}
                variant='outline'
                loading={savingVariant}
                disabled={loadingVariants}
                onPress={() => {
                  void handleAddVariant();
                }}
              />
            </View>
          </View>
        ) : null}

        {editingProductId && productTrackingMode === 'SERIAL' ? (
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Unités physiques (IMEI)</Text>
            <Text style={styles.helperText}>
              Les unités sont créées automatiquement lors des entrées en stock SERIAL et marquées vendues lors des ventes.
              Tapez sur une unité pour changer manuellement son statut (retour client, perte, casse, ...).
            </Text>

            <View style={styles.unitsFilterRow}>
              <ChipGroup
                options={[
                  { label: 'Tous', value: 'all' },
                  { label: 'En stock', value: 'IN_STOCK' },
                  { label: 'Vendus', value: 'SOLD' },
                  { label: 'Retournés', value: 'RETURNED' },
                  { label: 'Endommagés', value: 'DAMAGED' },
                  { label: 'Perdus', value: 'LOST' },
                ]}
                value={unitStatusFilter}
                onChange={(value) => setUnitStatusFilter(value as 'all' | ProductUnitStatus)}
                layout='row-scroll'
                tone='soft'
              />
            </View>

            {loadingProductUnits ? (
              <Text style={styles.helperText}>Chargement des unités...</Text>
            ) : (() => {
              const filteredUnits = unitStatusFilter === 'all'
                ? productUnits
                : productUnits.filter((u) => u.status === unitStatusFilter);
              if (filteredUnits.length === 0) {
                return <Text style={styles.helperText}>Aucune unité pour ce filtre.</Text>;
              }
              return (
                <View style={styles.unitsList}>
                  {filteredUnits.map((unit) => (
                    <Pressable
                      key={unit.id}
                      onPress={() => askChangeUnitStatus(unit)}
                      style={styles.unitRow}
                    >
                      <View style={styles.unitRowMain}>
                        <Text style={styles.unitSerial}>{unit.serialNumber}</Text>
                        <Text style={styles.unitMeta}>
                          {unit.purchaseDate ? `Achat ${formatDate(unit.purchaseDate)}` : 'Date inconnue'}
                          {unit.soldDate ? ` • Vendu ${formatDate(unit.soldDate)}` : ''}
                        </Text>
                      </View>
                      <Text
                        style={[styles.unitStatusBadge, { color: PRODUCT_UNIT_STATUS_COLORS[unit.status] }]}
                      >
                        {PRODUCT_UNIT_STATUS_LABELS[unit.status]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              );
            })()}
          </View>
        ) : null}

        <View style={styles.modalActions}>
          <View style={styles.actionItem}>
            <AppButton label='Retour' variant='outline' onPress={closeProductModal} disabled={saving || savingVariant} />
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
          onChange={(value) => {
            setMovementProductId(value);
            setMovementSerialNumbers('');
          }}
          disabled={products.length === 0}
        />

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

        {showMovementSerialNumbers ? (
          <View style={styles.formGroup}>
            <ImeiInput
              label='IMEI / numeros de serie'
              value={movementSerialNumbers}
              onChangeText={setMovementSerialNumbers}
              placeholder='Un IMEI par ligne (ou scannez avec la caméra)'
              helperText={`Renseignez exactement ${movementQuantity || '0'} IMEI pour ce produit SERIAL.`}
            />
          </View>
        ) : null}

        {/* Picker fournisseur — visible pour ENTREE / CONSIGNATION_ENTREE.
            Obligatoire pour CONSIGNATION_ENTREE (le fournisseur reste propriétaire). */}
        {(movementType === 'ENTREE' || movementType === 'CONSIGNATION_ENTREE') ? (
          <SearchableSelectField
            label={movementType === 'CONSIGNATION_ENTREE' ? 'Fournisseur (obligatoire)' : 'Fournisseur (optionnel)'}
            modalTitle='Selectionner un fournisseur'
            placeholder={providers.length === 0 ? 'Aucun fournisseur — créez-en un d\'abord' : 'Choisir un fournisseur'}
            value={movementProviderId}
            options={providers.map((p) => ({ label: p.name, value: p.id }))}
            onChange={setMovementProviderId}
            disabled={providers.length === 0}
          />
        ) : null}

        {/* Picker client — visible/obligatoire si source RETOUR_CLIENT */}
        {(movementType === 'ENTREE' || movementType === 'CONSIGNATION_ENTREE') ? (
          <InputField
            label="Prix d'achat unitaire (optionnel)"
            value={movementUnitPurchasePrice}
            onChangeText={setMovementUnitPurchasePrice}
            placeholder='Ex: 125000'
            keyboardType='decimal-pad'
          />
        ) : null}

        {movementSource === 'RETOUR_CLIENT' ? (
          <SearchableSelectField
            label='Client (obligatoire pour un retour)'
            modalTitle='Selectionner un client'
            placeholder={clients.length === 0 ? 'Aucun client — créez-en un d\'abord' : 'Choisir un client'}
            value={movementClientId}
            options={clients.map((c) => ({ label: c.name, value: c.id }))}
            onChange={setMovementClientId}
            disabled={clients.length === 0}
          />
        ) : null}

        <InputField
          label='Référence (optionnel)'
          value={movementReference}
          onChangeText={setMovementReference}
          placeholder='Ex: BL-2026-001, n° commande'
        />

        <InputField
          label={movementSource === 'AJUSTEMENT' ? 'Motif (obligatoire)' : 'Motif (optionnel)'}
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

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={(code) => {
          void handleBarcodeScanned(code);
        }}
        hint='Visez le code-barres du produit pour ouvrir sa fiche'
      />
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
  scanIconButton: {
    minHeight: 46,
    width: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral300,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
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
  helperText: {
    ...typography.caption,
    color: colors.neutral500,
    marginTop: 6,
  },
  consignmentToggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  consignmentToggleLabelWrap: {
    flex: 1,
    paddingRight: 4,
  },
  consignmentDetails: {
    marginTop: 12,
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.neutral200,
  },
  multilineInput: {
    minHeight: 96,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  flexHalf: {
    flex: 1,
  },
  variantList: {
    marginTop: 10,
    gap: 8,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  variantRowMain: {
    flex: 1,
    gap: 2,
  },
  variantName: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  variantMeta: {
    ...typography.caption,
    color: colors.neutral600,
  },
  unitsFilterRow: {
    marginTop: 8,
  },
  unitsList: {
    marginTop: 10,
    gap: 8,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  unitRowMain: {
    flex: 1,
    gap: 2,
  },
  unitSerial: {
    ...typography.bodyMedium,
    color: colors.neutral900,
    fontFamily: 'monospace',
  },
  unitMeta: {
    ...typography.caption,
    color: colors.neutral600,
  },
  unitStatusBadge: {
    ...typography.captionMedium,
    textTransform: 'uppercase',
  },
  variantErrorBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.danger100,
    borderWidth: 1,
    borderColor: colors.danger500,
  },
  variantErrorText: {
    ...typography.caption,
    color: colors.danger600,
  },
  variantAddBlock: {
    marginTop: 14,
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.neutral200,
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
