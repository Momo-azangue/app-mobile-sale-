import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  createSale,
  getByBarcode,
  getProduct,
  getProductUnitBySerialNumber,
  listAvailableProductUnits,
  listClients,
  listProducts,
  listProductVariants,
} from '../api/services';
import { getErrorMessage } from '../api/errors';
import type {
  ClientResponseDTO,
  InvoiceStatus,
  ProductResponseDTO,
  ProductUnitResponseDTO,
  ProductVariantResponseDTO,
  SaleRequestDTO,
} from '../types/api';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { AppButton } from '../components/common/AppButton';
import { AppCard } from '../components/common/AppCard';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { ChipGroup, type ChipOption } from '../components/common/ChipGroup';
import { InputField } from '../components/common/InputField';
import { MoneyInput } from '../components/common/MoneyInput';
import { SearchableSelectField, type SearchableSelectOption } from '../components/common/SearchableSelectField';
import { useToast } from '../components/common/ToastProvider';
import { useFormatCurrency } from '../context/AppSettingsContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { ImeiCaptureRow } from './sales/ImeiCaptureRow';

interface NouvelleVenteProps {
  onBack: () => void;
  onCreated: () => void;
  refreshSignal: number;
}

interface SaleLineForm {
  id: string;
  productId: string;
  variantId: string;
  quantity: string;
  priceAtSale: string;
  serialNumbers: string[];
  preferConsigned: boolean;
}

type ScannerTarget =
  | { type: 'product'; lineId: string }
  | { type: 'imei'; lineId: string; index: number };

const STATUS_OPTIONS: Array<{ label: string; value: InvoiceStatus }> = [
  { label: 'Payee', value: 'PAYE' },
  { label: 'Impayee', value: 'IMPAYE' },
  { label: 'Partielle', value: 'PARTIEL' },
];

function nextLineId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyLine(): SaleLineForm {
  return {
    id: nextLineId(),
    productId: '',
    variantId: '',
    quantity: '1',
    priceAtSale: '',
    serialNumbers: [],
    preferConsigned: false,
  };
}

function normalizeImei(value: string): string {
  return value.trim();
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

function variantAvailableStock(variant?: ProductVariantResponseDTO): number {
  return variant ? variant.quantity + variant.consignedQuantity : 0;
}

function salePrice(product?: ProductResponseDTO, variant?: ProductVariantResponseDTO): string {
  const price = variant?.price ?? product?.price;
  return price != null && Number.isFinite(price) ? String(price) : '';
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 && Math.trunc(parsed) === parsed ? parsed : 0;
}

function formatSaleError(error: unknown): string {
  const message = getErrorMessage(error);
  if (/product unit not found|unit not found|serial/i.test(message)) {
    return "IMEI non reconnu pour cette variante. Verifiez l'unite ou le produit choisi.";
  }
  if (/insufficient|stock/i.test(message)) {
    return `Stock insuffisant. ${message}`;
  }
  return message;
}

export function NouvelleVenteScreen({ onBack, onCreated, refreshSignal }: NouvelleVenteProps) {
  const toast = useToast();
  const fmtCurrency = useFormatCurrency();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariantResponseDTO[]>>({});
  const [availableUnitsByLine, setAvailableUnitsByLine] = useState<Record<string, ProductUnitResponseDTO[]>>({});
  const [loadingUnitsByLine, setLoadingUnitsByLine] = useState<Record<string, boolean>>({});

  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('IMPAYE');
  const [initialPaidAmount, setInitialPaidAmount] = useState('');
  const [lines, setLines] = useState<SaleLineForm[]>(() => [createEmptyLine()]);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [scannerTarget, setScannerTarget] = useState<ScannerTarget | null>(null);

  useEffect(() => {
    setVariantsByProduct({});
    setAvailableUnitsByLine({});
    setLoadingUnitsByLine({});
  }, [refreshSignal]);

  const loadReferences = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setError(null);
    try {
      const [fetchedClients, fetchedProducts] = await Promise.all([listClients(), listProducts()]);
      setClients(fetchedClients);
      setProducts(fetchedProducts);
      if (!clientId && fetchedClients.length > 0) {
        setClientId(fetchedClients[0].id);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadReferences(true);
  }, [loadReferences, refreshSignal]);

  useEffect(() => {
    setExpandedLineId((current) => current ?? lines[0]?.id ?? null);
  }, [lines]);

  const { refreshing, onRefresh } = usePullToRefresh(() => loadReferences(false));

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const clientOptions = useMemo<SearchableSelectOption[]>(
    () =>
      clients.map((client) => ({
        label: client.name,
        value: client.id,
        subtitle: [client.phone, client.email].filter(Boolean).join(' - ') || undefined,
        keywords: `${client.email ?? ''} ${client.phone ?? ''}`,
      })),
    [clients],
  );
  const statusOptions = useMemo<ChipOption[]>(
    () => STATUS_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );
  const productOptions = useMemo<SearchableSelectOption[]>(
    () =>
      products.map((product) => ({
        label: product.name,
        value: product.id,
        subtitle: [product.brand, product.categoryName, product.price != null ? `Prix ${product.price}` : null]
          .filter(Boolean)
          .join(' • '),
        keywords: `${product.sku ?? ''} ${product.barcode ?? ''}`,
      })),
    [products],
  );

  const loadVariantsForProduct = useCallback(
    async (productId: string): Promise<ProductVariantResponseDTO[]> => {
      if (!productId) {
        return [];
      }
      const cached = variantsByProduct[productId];
      if (cached) {
        return cached;
      }
      try {
        const variants = await listProductVariants(productId);
        setVariantsByProduct((previous) => ({ ...previous, [productId]: variants }));
        return variants;
      } catch {
        setVariantsByProduct((previous) => ({ ...previous, [productId]: [] }));
        return [];
      }
    },
    [variantsByProduct],
  );

  const loadAvailableUnitsForLine = useCallback(
    async (
      lineId: string,
      productId: string,
      variantId: string,
      trackingModeOverride?: ProductResponseDTO['trackingMode'],
    ) => {
      const product = productById.get(productId);
      const trackingMode = product?.trackingMode ?? trackingModeOverride;
      if (!productId || !variantId || trackingMode !== 'SERIAL') {
        setAvailableUnitsByLine((previous) => ({ ...previous, [lineId]: [] }));
        setLoadingUnitsByLine((previous) => ({ ...previous, [lineId]: false }));
        return;
      }
      setLoadingUnitsByLine((previous) => ({ ...previous, [lineId]: true }));
      try {
        const units = await listAvailableProductUnits(productId, variantId);
        setAvailableUnitsByLine((previous) => ({ ...previous, [lineId]: units }));
      } catch {
        setAvailableUnitsByLine((previous) => ({ ...previous, [lineId]: [] }));
      } finally {
        setLoadingUnitsByLine((previous) => ({ ...previous, [lineId]: false }));
      }
    },
    [productById],
  );

  const updateLine = (lineId: string, patch: Partial<SaleLineForm>) => {
    setLines((previous) => previous.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const selectVariantForLine = useCallback(
    async (lineId: string, product: ProductResponseDTO, variant: ProductVariantResponseDTO | null) => {
      const nextVariantId = variant?.id ?? '';
      updateLine(lineId, {
        productId: product.id,
        variantId: nextVariantId,
        serialNumbers: [],
        quantity: '1',
        priceAtSale: salePrice(product, variant ?? undefined),
        preferConsigned: false,
      });
      if (nextVariantId) {
        await loadAvailableUnitsForLine(lineId, product.id, nextVariantId, product.trackingMode);
      }
    },
    [loadAvailableUnitsForLine],
  );

  const selectProductForLine = useCallback(
    async (lineId: string, productId: string, preferredVariantId?: string) => {
      const product = productById.get(productId);
      if (!product) {
        return;
      }
      const variants = await loadVariantsForProduct(productId);
      const availableVariants = variants.filter((variant) => variantAvailableStock(variant) > 0);
      const preferred = preferredVariantId
        ? variants.find((variant) => variant.id === preferredVariantId)
        : undefined;
      const autoVariant =
        preferred
        ?? (product.trackingMode === 'NONE' && variants.length === 1 ? variants[0] : undefined)
        ?? (product.trackingMode === 'SERIAL' && availableVariants.length === 1 ? availableVariants[0] : undefined);

      await selectVariantForLine(lineId, product, autoVariant ?? null);
    },
    [loadVariantsForProduct, productById, selectVariantForLine],
  );

  const handleProductChange = (lineId: string, productId: string) => {
    void selectProductForLine(lineId, productId);
  };

  const handleVariantChange = (line: SaleLineForm, variantId: string) => {
    const product = productById.get(line.productId);
    const variant = variantsByProduct[line.productId]?.find((item) => item.id === variantId);
    updateLine(line.id, {
      variantId,
      serialNumbers: [],
      priceAtSale: line.priceAtSale || salePrice(product, variant),
      preferConsigned: false,
    });
    if (product && variantId) {
      void loadAvailableUnitsForLine(line.id, product.id, variantId);
    }
  };

  const addLine = () => {
    const nextLine = createEmptyLine();
    setLines((previous) => [...previous, nextLine]);
    setExpandedLineId(nextLine.id);
  };

  const removeLine = (lineId: string) => {
    setLines((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      const next = previous.filter((line) => line.id !== lineId);
      if (expandedLineId === lineId) {
        setExpandedLineId(next[0]?.id ?? null);
      }
      return next;
    });
    setAvailableUnitsByLine((previous) => {
      const next = { ...previous };
      delete next[lineId];
      return next;
    });
  };

  const setLineImei = (lineId: string, index: number, value: string) => {
    setLines((previous) =>
      previous.map((line) => {
        if (line.id !== lineId) {
          return line;
        }
        const nextSerials = [...line.serialNumbers];
        nextSerials[index] = value;
        return { ...line, serialNumbers: nextSerials };
      }),
    );
  };

  const allEnteredImeis = useMemo(
    () =>
      lines.flatMap((line) =>
        line.serialNumbers.map((serial) => normalizeImei(serial)).filter(Boolean),
      ),
    [lines],
  );

  const duplicateImeiSet = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    allEnteredImeis.forEach((serial) => {
      const key = serial.toUpperCase();
      if (seen.has(key)) {
        duplicates.add(key);
      }
      seen.add(key);
    });
    return duplicates;
  }, [allEnteredImeis]);

  const validateImei = (line: SaleLineForm, index: number): string | undefined => {
    const serial = normalizeImei(line.serialNumbers[index] ?? '');
    if (!serial) {
      return 'Obligatoire';
    }
    if (!/^[a-zA-Z0-9]+$/.test(serial)) {
      return 'Format alphanumerique uniquement';
    }
    if (duplicateImeiSet.has(serial.toUpperCase())) {
      return 'Deja saisi dans cette vente';
    }
    const allowed = availableUnitsByLine[line.id] ?? [];
    const loadingUnits = loadingUnitsByLine[line.id] ?? false;
    if (!loadingUnits && allowed.length === 0) {
      return 'Aucune unite disponible pour cette variante';
    }
    if (!loadingUnits && !allowed.some((unit) => unit.serialNumber === serial)) {
      return `IMEI ${serial} non reconnu pour cette variante`;
    }
    return undefined;
  };

  const getLineValidity = (line: SaleLineForm): boolean => {
    const product = productById.get(line.productId);
    const quantity = parsePositiveInteger(line.quantity);
    const priceAtSale = Number(line.priceAtSale.replace(',', '.').trim());
    if (!line.productId || !line.variantId || quantity <= 0 || !Number.isFinite(priceAtSale) || priceAtSale <= 0) {
      return false;
    }
    if (product?.trackingMode !== 'SERIAL') {
      return true;
    }
    if ((loadingUnitsByLine[line.id] ?? false)) {
      return false;
    }
    for (let index = 0; index < quantity; index += 1) {
      if (validateImei(line, index)) {
        return false;
      }
    }
    return true;
  };

  const draftTotal = useMemo(
    () =>
      lines.reduce((total, line) => {
        const quantity = parsePositiveInteger(line.quantity);
        const price = Number(line.priceAtSale.replace(',', '.').trim());
        if (quantity <= 0 || !Number.isFinite(price) || price <= 0) {
          return total;
        }
        return total + quantity * price;
      }, 0),
    [lines],
  );
  const allLinesValid = lines.length > 0 && lines.every(getLineValidity);
  const canSubmit = Boolean(clientId) && allLinesValid && draftTotal > 0 && !submitting;

  const buildPayload = (): SaleRequestDTO | null => {
    if (!clientId) {
      Alert.alert('Validation', 'Selectionnez un client.');
      return null;
    }
    if (!allLinesValid) {
      Alert.alert('Validation', 'Completez chaque ligne : produit, variante, quantite, prix et IMEI si necessaire.');
      return null;
    }

    let payloadInitialPaidAmount: number | undefined;
    if (status === 'PAYE') {
      payloadInitialPaidAmount = draftTotal;
    }
    if (status === 'PARTIEL') {
      const parsedInitialPaidAmount = Number(initialPaidAmount.replace(',', '.').trim());
      if (!Number.isFinite(parsedInitialPaidAmount) || parsedInitialPaidAmount <= 0 || parsedInitialPaidAmount >= draftTotal) {
        Alert.alert('Validation', 'Pour un statut partiel, entrez une avance > 0 et strictement inferieure au total.');
        return null;
      }
      payloadInitialPaidAmount = parsedInitialPaidAmount;
    }

    return {
      clientId,
      products: lines.map((line) => {
        const product = productById.get(line.productId);
        const quantity = parsePositiveInteger(line.quantity);
        return {
          productId: line.productId,
          variantId: line.variantId,
          quantity,
          priceAtSale: Number(line.priceAtSale.replace(',', '.').trim()),
          preferConsigned: product?.trackingMode === 'NONE' ? line.preferConsigned : undefined,
          serialNumbers: product?.trackingMode === 'SERIAL'
            ? line.serialNumbers.slice(0, quantity).map(normalizeImei)
            : undefined,
        };
      }),
      date: new Date().toISOString(),
      invoiceStatus: status,
      initialPaidAmount: payloadInitialPaidAmount,
    };
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    setSubmitting(true);
    try {
      await createSale(payload);
      onCreated();
      onBack();
      toast.success('Vente creee avec succes.');
    } catch (caught) {
      const message = formatSaleError(caught);
      setSubmitError(message);
      Alert.alert('Erreur creation vente', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProductScan = async (lineId: string, code: string) => {
    try {
      const lookup = await getByBarcode(code);
      setProducts((previous) =>
        previous.some((product) => product.id === lookup.product.id)
          ? previous
          : [...previous, lookup.product],
      );
      if (lookup.variant) {
        setVariantsByProduct((previous) => {
          const current = previous[lookup.product.id] ?? [];
          const exists = current.some((variant) => variant.id === lookup.variant?.id);
          return {
            ...previous,
            [lookup.product.id]: exists ? current : [...current, lookup.variant as ProductVariantResponseDTO],
          };
        });
      }
      if (lookup.variant) {
        await selectVariantForLine(lineId, lookup.product, lookup.variant);
      } else {
        const variants = await loadVariantsForProduct(lookup.product.id);
        const availableVariants = variants.filter((variant) => variantAvailableStock(variant) > 0);
        const autoVariant =
          lookup.product.trackingMode === 'NONE' && variants.length === 1
            ? variants[0]
            : lookup.product.trackingMode === 'SERIAL' && availableVariants.length === 1
              ? availableVariants[0]
              : undefined;
        await selectVariantForLine(lineId, lookup.product, autoVariant ?? null);
      }
    } catch (scanError) {
      Alert.alert('Produit introuvable', `Aucun produit avec le code "${code}".\n${getErrorMessage(scanError)}`);
    }
  };

  const handleImeiScan = async (lineId: string, index: number, code: string) => {
    const serial = normalizeImei(code);
    if (!serial) {
      return;
    }

    const targetLine = lines.find((line) => line.id === lineId);
    if (!targetLine) {
      return;
    }

    const alreadyUsed = lines.some((line) =>
      line.serialNumbers.some((candidate, candidateIndex) => {
        if (line.id === lineId && candidateIndex === index) {
          return false;
        }
        return normalizeImei(candidate).toUpperCase() === serial.toUpperCase();
      }),
    );

    if (alreadyUsed) {
      Alert.alert('Validation', 'Cet IMEI est deja saisi dans la vente.');
      return;
    }

    try {
      const unit = await getProductUnitBySerialNumber(serial);
      if (unit.status !== 'IN_STOCK') {
        Alert.alert('IMEI indisponible', `L'IMEI ${serial} n'est pas disponible a la vente.`);
        return;
      }
      if (targetLine.productId && targetLine.productId !== unit.productId) {
        Alert.alert('IMEI incoherent', "Cet IMEI n'appartient pas au produit choisi sur cette ligne.");
        return;
      }
      if (targetLine.variantId && targetLine.variantId !== unit.variantId) {
        Alert.alert('IMEI incoherent', "Cet IMEI n'appartient pas a la variante choisie sur cette ligne.");
        return;
      }

      let product = productById.get(unit.productId);
      if (!product) {
        product = await getProduct(unit.productId);
        setProducts((previous) =>
          previous.some((item) => item.id === product?.id)
            ? previous
            : [...previous, product as ProductResponseDTO],
        );
      }

      const variants = await loadVariantsForProduct(unit.productId);
      const variant = variants.find((item) => item.id === unit.variantId);
      if (!variant) {
        Alert.alert('Variante introuvable', "La variante liee a cet IMEI n'est pas disponible sur l'appareil.");
        return;
      }

      const nextSerials = [...targetLine.serialNumbers];
      nextSerials[index] = serial;
      const nextQuantity = Math.max(parsePositiveInteger(targetLine.quantity), index + 1, 1);

      updateLine(lineId, {
        productId: product.id,
        variantId: variant.id,
        quantity: String(nextQuantity),
        priceAtSale: targetLine.priceAtSale || salePrice(product, variant),
        serialNumbers: nextSerials,
        preferConsigned: false,
      });
      await loadAvailableUnitsForLine(lineId, product.id, variant.id, product.trackingMode);
      setExpandedLineId(lineId);
    } catch (scanError) {
      Alert.alert('IMEI introuvable', `Aucune unite en stock avec l'IMEI "${serial}".\n${getErrorMessage(scanError)}`);
    }
  };

  const handleScannerResult = (code: string) => {
    const target = scannerTarget;
    setScannerTarget(null);
    if (!target) {
      return;
    }
    if (target.type === 'product') {
      void handleProductScan(target.lineId, code);
      return;
    }
    void handleImeiScan(target.lineId, target.index, code);
  };

  if (loading) {
    return <LoadingState message='Chargement references...' />;
  }

  if (error) {
    return <ErrorState title='Erreur references' message={error} onRetry={() => void loadReferences()} />;
  }

  if (clients.length === 0) {
    return (
      <View style={styles.centeredWrap}>
        <EmptyState
          icon='users'
          title='Aucun client'
          description='Ajoutez un client avant de creer une vente.'
          actionLabel='Retour'
          onAction={onBack}
        />
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.centeredWrap}>
        <EmptyState
          icon='package'
          title='Aucun produit'
          description='Creez un produit et ses variantes dans Stocks avant de vendre.'
          actionLabel='Retour'
          onAction={onBack}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />}
      >
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backLabel}>Retour</Text>
        </Pressable>

        <ScreenHeader title='Nouvelle vente' subtitle='Scanner, encaisser, facturer' />

        {submitError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <SearchableSelectField
            label='Client'
            modalTitle='Selectionner un client'
            placeholder='Choisir un client'
            value={clientId}
            options={clientOptions}
            onChange={setClientId}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Statut facture</Text>
          <ChipGroup
            options={statusOptions}
            value={status}
            onChange={(value) => {
              setStatus(value as InvoiceStatus);
              if (value !== 'PARTIEL') {
                setInitialPaidAmount('');
              }
            }}
            layout='wrap'
            tone='solid'
          />
        </View>

        {status === 'PARTIEL' ? (
          <View style={styles.formGroup}>
            <MoneyInput
              label='Montant avance'
              value={initialPaidAmount}
              onChangeText={setInitialPaidAmount}
              placeholder='100'
            />
            <Text style={styles.statusHint}>Doit etre strictement inferieur au total de la vente.</Text>
          </View>
        ) : null}

        {draftTotal > 0 ? (
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total provisoire</Text>
            <Text style={styles.totalPreview}>{fmtCurrency(draftTotal)}</Text>
          </View>
        ) : null}

        {lines.map((line, index) => (
          <SaleLineCard
            key={line.id}
            index={index}
            line={line}
            product={productById.get(line.productId)}
            variants={variantsByProduct[line.productId] ?? []}
            productOptions={productOptions}
            availableUnits={availableUnitsByLine[line.id] ?? []}
            loadingUnits={loadingUnitsByLine[line.id] ?? false}
            canRemove={lines.length > 1}
            expanded={expandedLineId === line.id}
            duplicateImeiSet={duplicateImeiSet}
            validateImei={validateImei}
            onToggle={() => setExpandedLineId(line.id)}
            onRemove={() => removeLine(line.id)}
            onProductChange={(productId) => handleProductChange(line.id, productId)}
            onProductScan={() => setScannerTarget({ type: 'imei', lineId: line.id, index: 0 })}
            onVariantChange={(variantId) => handleVariantChange(line, variantId)}
            onQuantityChange={(quantity) => updateLine(line.id, { quantity })}
            onPriceChange={(priceAtSale) => updateLine(line.id, { priceAtSale })}
            onPreferConsignedChange={(preferConsigned) => updateLine(line.id, { preferConsigned })}
            onImeiChange={(imeiIndex, value) => setLineImei(line.id, imeiIndex, value)}
            onImeiScan={(imeiIndex) => setScannerTarget({ type: 'imei', lineId: line.id, index: imeiIndex })}
          />
        ))}

        <AppButton label='Ajouter une ligne' variant='outline' onPress={addLine} />

        <View style={styles.submitWrap}>
          <AppButton
            label={submitting ? 'Creation...' : 'Valider la vente'}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
            loading={submitting}
          />
        </View>
      </ScrollView>

      <BarcodeScanner
        visible={scannerTarget !== null}
        expect={scannerTarget?.type === 'imei' ? 'imei' : 'product'}
        onClose={() => setScannerTarget(null)}
        onScan={handleScannerResult}
      />
    </View>
  );
}

interface SaleLineCardProps {
  index: number;
  line: SaleLineForm;
  product?: ProductResponseDTO;
  variants: ProductVariantResponseDTO[];
  productOptions: SearchableSelectOption[];
  availableUnits: ProductUnitResponseDTO[];
  loadingUnits: boolean;
  canRemove: boolean;
  expanded: boolean;
  duplicateImeiSet: Set<string>;
  validateImei: (line: SaleLineForm, index: number) => string | undefined;
  onToggle: () => void;
  onRemove: () => void;
  onProductChange: (productId: string) => void;
  onProductScan: () => void;
  onVariantChange: (variantId: string) => void;
  onQuantityChange: (quantity: string) => void;
  onPriceChange: (price: string) => void;
  onPreferConsignedChange: (value: boolean) => void;
  onImeiChange: (index: number, value: string) => void;
  onImeiScan: (index: number) => void;
}

function SaleLineCard({
  index,
  line,
  product,
  variants,
  productOptions,
  availableUnits,
  loadingUnits,
  canRemove,
  expanded,
  duplicateImeiSet,
  validateImei,
  onToggle,
  onRemove,
  onProductChange,
  onProductScan,
  onVariantChange,
  onQuantityChange,
  onPriceChange,
  onPreferConsignedChange,
  onImeiChange,
  onImeiScan,
}: SaleLineCardProps) {
  const fmtCurrency = useFormatCurrency();
  const selectedVariant = variants.find((variant) => variant.id === line.variantId);
  const isSerial = product?.trackingMode === 'SERIAL';
  const saleableVariants = isSerial
    ? variants.filter((variant) => variantAvailableStock(variant) > 0)
    : variants;
  const variantOptions = saleableVariants.map((variant) => ({
    label: variantLabel(variant),
    value: variant.id,
    subtitle: `Stock ${variant.quantity}${variant.consignedQuantity ? ` • Consigne ${variant.consignedQuantity}` : ''}${variant.price != null ? ` • Prix ${variant.price}` : ''}`,
  }));
  const variantChipOptions = saleableVariants.map((variant) => ({
    label: variantLabel(variant),
    value: variant.id,
  }));
  const quantity = parsePositiveInteger(line.quantity);
  const serialIndexes = Array.from({ length: isSerial ? quantity : 0 }, (_, itemIndex) => itemIndex);
  const showPreferConsigned = !isSerial && Boolean(selectedVariant && selectedVariant.consignedQuantity > 0);
  const parsedPrice = Number(line.priceAtSale.replace(',', '.').trim());
  const lineTotal = quantity > 0 && Number.isFinite(parsedPrice) && parsedPrice > 0
    ? quantity * parsedPrice
    : null;
  const enteredSerials = line.serialNumbers.map(normalizeImei).filter(Boolean);
  const summaryTitle = product
    ? [product.name, selectedVariant ? variantLabel(selectedVariant) : null].filter(Boolean).join(' - ')
    : `Ligne ${index + 1}`;
  const summaryMeta = product
    ? `${quantity || 0} unite${quantity > 1 ? 's' : ''}${lineTotal != null ? ` - Total ${fmtCurrency(lineTotal)}` : ''}`
    : 'A completer';

  if (!expanded) {
    return (
      <Pressable onPress={onToggle}>
        <AppCard style={[styles.lineCard, styles.collapsedLineCard]}>
          <View style={styles.collapsedHeader}>
            <View style={styles.collapsedMain}>
              <View style={styles.collapsedTitleRow}>
                <Text style={styles.lineTitle} numberOfLines={1}>{summaryTitle}</Text>
                {selectedVariant?.consignedQuantity ? <Badge label='Consigne dispo' /> : null}
              </View>
              <Text style={styles.collapsedMeta} numberOfLines={1}>{summaryMeta}</Text>
              {enteredSerials.length > 0 ? (
                <Text style={styles.collapsedMeta} numberOfLines={1}>
                  IMEI {enteredSerials.join(', ')}
                </Text>
              ) : null}
            </View>
            <View style={styles.collapsedActions}>
              {canRemove ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onRemove();
                  }}
                  hitSlop={8}
                >
                  <Feather name='trash-2' size={17} color={colors.danger600} />
                </Pressable>
              ) : null}
              <Feather name='chevron-down' size={18} color={colors.neutral500} />
            </View>
          </View>
        </AppCard>
      </Pressable>
    );
  }

  return (
    <AppCard style={styles.lineCard}>
      <View style={styles.lineHeader}>
        <View style={styles.lineTitleWrap}>
          <Text style={styles.lineTitle}>Ligne {index + 1}</Text>
          {selectedVariant?.consignedQuantity ? <Badge label='Consigne dispo' /> : null}
        </View>
        <View style={styles.expandedActions}>
          <Pressable onPress={onToggle} hitSlop={8}>
            <Feather name='chevron-up' size={18} color={colors.neutral500} />
          </Pressable>
          <Pressable onPress={onRemove} disabled={!canRemove}>
            <Text style={[styles.removeText, !canRemove && styles.removeDisabled]}>Supprimer</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.productPickerRow}>
        <SearchableSelectField
          label='Produit'
          modalTitle={`Selectionner un produit (ligne ${index + 1})`}
          placeholder='Choisir un produit'
          value={line.productId}
          options={productOptions}
          onChange={onProductChange}
          containerStyle={styles.productPicker}
        />
        <Pressable style={styles.scanButton} onPress={onProductScan} hitSlop={8}>
          <Feather name='camera' size={18} color={colors.white} />
        </Pressable>
      </View>

      {product ? (
        <>
          {isSerial && saleableVariants.length > 1 ? (
            <View style={styles.formGroupTight}>
              <Text style={styles.label}>Variante disponible</Text>
              <ChipGroup
                options={variantChipOptions}
                value={line.variantId}
                onChange={onVariantChange}
                layout='wrap'
                tone='soft'
              />
            </View>
          ) : (
            <SearchableSelectField
              label='Variante'
              modalTitle='Selectionner une variante'
              placeholder={saleableVariants.length === 0 ? 'Aucune variante disponible' : 'Choisir une variante'}
              value={line.variantId}
              options={variantOptions}
              onChange={onVariantChange}
              disabled={saleableVariants.length === 0}
            />
          )}

          {selectedVariant ? (
            <Text style={styles.variantHint}>
              {variantLabel(selectedVariant)} • Stock {selectedVariant.quantity}
              {selectedVariant.consignedQuantity ? ` • Consigne ${selectedVariant.consignedQuantity}` : ''}
            </Text>
          ) : null}
        </>
      ) : null}

      <View style={styles.row}>
        <InputField
          label='Quantite'
          value={line.quantity}
          onChangeText={onQuantityChange}
          keyboardType='numeric'
          placeholder='1'
          containerStyle={styles.flexHalf}
        />
        <MoneyInput
          label='Prix vente'
          value={line.priceAtSale}
          onChangeText={onPriceChange}
          placeholder='100'
          containerStyle={styles.flexHalf}
        />
      </View>

      {showPreferConsigned ? (
        <View style={styles.consignedToggleRow}>
          <View style={styles.consignedTextWrap}>
            <Text style={styles.label}>Vendre consigne en priorite</Text>
            <Text style={styles.statusHint}>Le stock fournisseur sera draine avant le stock propre.</Text>
          </View>
          <Switch
            value={line.preferConsigned}
            onValueChange={onPreferConsignedChange}
            trackColor={{ false: colors.neutral300, true: colors.warning600 }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      {isSerial ? (
        <View style={styles.serialBlock}>
          <Text style={styles.label}>IMEI a vendre</Text>
          <Text style={styles.statusHint}>
            {loadingUnits
              ? 'Verification des IMEI disponibles...'
              : `${availableUnits.length} unite${availableUnits.length > 1 ? 's' : ''} disponible${availableUnits.length > 1 ? 's' : ''} pour cette variante.`}
          </Text>
          {quantity <= 0 ? (
            <Text style={styles.statusHint}>Entrez une quantite pour afficher les champs IMEI.</Text>
          ) : (
            serialIndexes.map((imeiIndex) => (
              <ImeiCaptureRow
                key={`${line.id}-${imeiIndex}`}
                index={imeiIndex}
                value={line.serialNumbers[imeiIndex] ?? ''}
                onChange={(value) => onImeiChange(imeiIndex, value)}
                onScan={() => onImeiScan(imeiIndex)}
                error={validateImei(line, imeiIndex)}
              />
            ))
          )}
          {duplicateImeiSet.size > 0 ? (
            <Text style={styles.errorText}>Un meme IMEI ne peut pas etre utilise deux fois dans la vente.</Text>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
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
    paddingBottom: 48,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  centeredWrap: {
    flex: 1,
    backgroundColor: colors.neutral50,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral200,
    marginBottom: 12,
    ...shadows.sm,
  },
  backLabel: {
    ...typography.label,
    color: colors.neutral700,
  },
  formGroup: {
    marginBottom: 16,
  },
  formGroupTight: {
    gap: 8,
  },
  label: {
    ...typography.label,
    color: colors.neutral700,
  },
  lineCard: {
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  collapsedLineCard: {
    gap: 0,
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  collapsedMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  collapsedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedMeta: {
    ...typography.caption,
    color: colors.neutral500,
  },
  collapsedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  expandedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lineTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineTitle: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  removeText: {
    ...typography.label,
    color: colors.danger600,
  },
  removeDisabled: {
    opacity: 0.5,
  },
  productPickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  productPicker: {
    flex: 1,
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary600,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  variantHint: {
    ...typography.caption,
    color: colors.neutral500,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  flexHalf: {
    flex: 1,
  },
  consignedToggleRow: {
    borderWidth: 1,
    borderColor: colors.warning100,
    backgroundColor: colors.warning100,
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  consignedTextWrap: {
    flex: 1,
    gap: 4,
  },
  serialBlock: {
    gap: 8,
  },
  submitWrap: {
    marginTop: 12,
  },
  statusHint: {
    ...typography.caption,
    color: colors.neutral500,
  },
  totalBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    backgroundColor: colors.white,
    padding: 12,
    marginBottom: 12,
    ...shadows.sm,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.neutral500,
  },
  totalPreview: {
    ...typography.h2,
    color: colors.neutral900,
  },
  errorBanner: {
    backgroundColor: colors.danger100,
    borderColor: colors.danger600,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    ...typography.label,
    color: colors.danger600,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger600,
  },
  badge: {
    borderRadius: radius.pill,
    backgroundColor: colors.warning100,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    ...typography.captionMedium,
    color: colors.warning600,
  },
});
