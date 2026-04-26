import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createSale, listClients, listProductVariants, listProducts } from '../api/services';
import { getErrorMessage } from '../api/errors';
import type {
  ClientResponseDTO,
  InvoiceStatus,
  ProductResponseDTO,
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
import { ChipGroup } from '../components/common/ChipGroup';
import { InputField } from '../components/common/InputField';
import { SearchableSelectField, type SearchableSelectOption } from '../components/common/SearchableSelectField';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface NouvelleVenteProps {
  onBack: () => void;
  onCreated: () => void;
  refreshSignal: number;
}

interface SaleLineForm {
  id: string;
  productId: string;
  /** Vide = la variante par defaut sera resolue par le backend. */
  variantId: string;
  quantity: string;
  priceAtSale: string;
}

const STATUS_OPTIONS: Array<{ label: string; value: InvoiceStatus }> = [
  { label: 'Payee', value: 'PAYE' },
  { label: 'Impayee', value: 'IMPAYE' },
  { label: 'Partielle', value: 'PARTIEL' },
];

function nextLineId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function NouvelleVenteScreen({ onBack, onCreated, refreshSignal }: NouvelleVenteProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);

  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('IMPAYE');
  const [initialPaidAmount, setInitialPaidAmount] = useState('');
  const [lines, setLines] = useState<SaleLineForm[]>([
    { id: nextLineId(), productId: '', variantId: '', quantity: '1', priceAtSale: '' },
  ]);

  // Cache productId -> variantes nommées (excluant la default sans nom).
  // Invalidé à chaque refreshSignal pour récupérer les variantes créées ailleurs (Stocks).
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariantResponseDTO[]>>({});

  useEffect(() => {
    setVariantsByProduct({});
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
  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );
  const productOptions = useMemo<SearchableSelectOption[]>(
    () =>
      products.map((product) => ({
        label: product.name,
        value: product.id,
        subtitle: [
          Number.isFinite(product.price) ? `Prix ${product.price}` : null,
          product.categoryName ?? null,
        ]
          .filter(Boolean)
          .join(' - '),
      })),
    [products],
  );
  const draftTotal = useMemo(
    () =>
      lines.reduce((total, line) => {
        const quantity = Number(line.quantity);
        const price = Number(line.priceAtSale);
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
          return total;
        }
        return total + quantity * price;
      }, 0),
    [lines],
  );

  const updateLine = (lineId: string, patch: Partial<SaleLineForm>) => {
    setLines((previous) => previous.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    setLines((previous) => [
      ...previous,
      { id: nextLineId(), productId: '', variantId: '', quantity: '1', priceAtSale: '' },
    ]);
  };

  const removeLine = (lineId: string) => {
    setLines((previous) => (previous.length > 1 ? previous.filter((line) => line.id !== lineId) : previous));
  };

  const ensureVariantsLoaded = useCallback(async (productId: string) => {
    if (!productId || variantsByProduct[productId] !== undefined) return;
    try {
      const variants = await listProductVariants(productId);
      const named = variants.filter((v) => v.name && v.name.trim().length > 0);
      setVariantsByProduct((prev) => ({ ...prev, [productId]: named }));
    } catch {
      // Silencieux : si on ne peut pas charger, on ne montre juste pas le picker
      setVariantsByProduct((prev) => ({ ...prev, [productId]: [] }));
    }
  }, [variantsByProduct]);

  const handleProductChange = (lineId: string, productId: string) => {
    // Reset variantId quand on change de produit (les variantes sont liées au produit)
    updateLine(lineId, { productId, variantId: '' });
    void ensureVariantsLoaded(productId);
  };

  const buildPayload = (): SaleRequestDTO | null => {
    if (!clientId) {
      Alert.alert('Validation', 'Selectionnez un client.');
      return null;
    }

    const mappedProducts = lines.map((line) => {
      const quantity = Number(line.quantity);
      const priceAtSale = Number(line.priceAtSale);

      return {
        productId: line.productId,
        quantity,
        priceAtSale,
        selectedProduct: productById.get(line.productId),
      };
    });

    const invalidLine = mappedProducts.find(
      (line) =>
        !line.productId ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isFinite(line.priceAtSale) ||
        line.priceAtSale <= 0,
    );

    if (invalidLine) {
      Alert.alert('Validation', 'Chaque ligne doit avoir un produit, une quantite > 0 et un prix > 0.');
      return null;
    }

    const minPriceViolation = mappedProducts.find((line) => {
      const minPrice = line.selectedProduct?.price;
      if (!Number.isFinite(minPrice)) {
        return false;
      }
      return line.priceAtSale < (minPrice as number);
    });
    if (minPriceViolation?.selectedProduct && Number.isFinite(minPriceViolation.selectedProduct.price)) {
      Alert.alert(
        'Validation',
        `Le prix de vente de ${minPriceViolation.selectedProduct.name} ne peut pas etre inferieur au prix configure (${minPriceViolation.selectedProduct.price}).`,
      );
      return null;
    }

    const totalAmount = mappedProducts.reduce((total, line) => total + line.quantity * line.priceAtSale, 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      Alert.alert('Validation', 'Le montant total de la vente doit etre strictement positif.');
      return null;
    }

    let payloadInitialPaidAmount: number | undefined;
    if (status === 'PAYE') {
      payloadInitialPaidAmount = totalAmount;
    }
    if (status === 'PARTIEL') {
      const parsedInitialPaidAmount = Number(initialPaidAmount);
      if (!Number.isFinite(parsedInitialPaidAmount) || parsedInitialPaidAmount <= 0 || parsedInitialPaidAmount >= totalAmount) {
        Alert.alert('Validation', 'Pour un statut partiel, entrez une avance > 0 et strictement inferieure au total.');
        return null;
      }
      payloadInitialPaidAmount = parsedInitialPaidAmount;
    }

    return {
      clientId,
      products: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId || undefined,
        quantity: Number(line.quantity),
        priceAtSale: Number(line.priceAtSale),
      })),
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
      // Redirection garantie : on ne dépend pas du callback de l'Alert (qui peut
      // ne jamais s'exécuter selon la plateforme/le focus).
      onCreated();
      onBack();
      Alert.alert('Succes', 'Vente creee avec succes.');
    } catch (caught) {
      // Log brut pour faciliter le debug (visible dans Metro/Expo logs)
      // eslint-disable-next-line no-console
      console.error('Sale creation failed:', (caught as { response?: { data?: unknown } })?.response?.data ?? caught);
      const message = getErrorMessage(caught);
      setSubmitError(message);
      Alert.alert('Erreur creation vente', message);
    } finally {
      setSubmitting(false);
    }
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
          description='Ajoutez des produits avant de creer une vente.'
          actionLabel='Retour'
          onAction={onBack}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
      }
    >
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backLabel}>Retour</Text>
      </Pressable>

      <ScreenHeader title='Nouvelle vente' subtitle='Creation d une vente et generation de facture' />

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
        {status === 'PAYE' ? (
          <Text style={styles.statusHint}>Le total sera regle automatiquement a la creation de la vente.</Text>
        ) : null}
      </View>

      {status === 'PARTIEL' ? (
        <View style={styles.formGroup}>
          <InputField
            label='Montant avance'
            value={initialPaidAmount}
            onChangeText={setInitialPaidAmount}
            keyboardType='decimal-pad'
            placeholder='Ex: 100'
          />
          <Text style={styles.statusHint}>Doit etre strictement inferieur au total de la vente.</Text>
        </View>
      ) : null}

      {draftTotal > 0 ? (
        <View style={styles.formGroup}>
          <Text style={styles.totalPreview}>Total provisoire: {draftTotal.toFixed(2)}</Text>
        </View>
      ) : null}

      {lines.map((line, index) => {
        const selectedProduct = productById.get(line.productId);
        const variantsForProduct = variantsByProduct[line.productId] ?? [];
        const variantOptions: SearchableSelectOption[] = variantsForProduct.map((v) => ({
          label: v.name ?? 'Variante',
          value: v.id,
          subtitle: v.price != null ? `Prix ${v.price}` : undefined,
        }));
        return (
          <AppCard key={line.id} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineTitle}>Ligne {index + 1}</Text>
              <Pressable onPress={() => removeLine(line.id)} disabled={lines.length === 1}>
                <Text style={[styles.removeText, lines.length === 1 && styles.removeDisabled]}>Supprimer</Text>
              </Pressable>
            </View>

            <SearchableSelectField
              label='Produit'
              modalTitle={`Selectionner un produit (ligne ${index + 1})`}
              placeholder='Choisir un produit'
              value={line.productId}
              options={productOptions}
              onChange={(value) => handleProductChange(line.id, value)}
            />

            {variantsForProduct.length > 0 ? (
              <SearchableSelectField
                label='Variante'
                modalTitle='Selectionner une variante'
                placeholder='Choisir une variante (sinon defaut)'
                value={line.variantId}
                options={variantOptions}
                onChange={(value) => updateLine(line.id, { variantId: value })}
              />
            ) : null}

            <Text style={styles.selectedProductText}>Selection: {selectedProduct?.name ?? '-'}</Text>
            <Text style={styles.selectedProductText}>
              Prix configure: {Number.isFinite(selectedProduct?.price) ? selectedProduct?.price : '-'}
            </Text>

            <View style={styles.row}>
              <InputField
                label='Quantite'
                value={line.quantity}
                onChangeText={(value) => updateLine(line.id, { quantity: value })}
                keyboardType='numeric'
                placeholder='1'
                containerStyle={styles.flexHalf}
              />

              <InputField
                label='Prix vente'
                value={line.priceAtSale}
                onChangeText={(value) => updateLine(line.id, { priceAtSale: value })}
                keyboardType='decimal-pad'
                placeholder='100'
                containerStyle={styles.flexHalf}
              />
            </View>
          </AppCard>
        );
      })}

      <AppButton label='Ajouter une ligne' variant='outline' onPress={addLine} />

      <View style={styles.submitWrap}>
        <AppButton
          label={submitting ? 'Creation...' : 'Enregistrer la vente'}
          onPress={() => {
            void handleSubmit();
          }}
          disabled={submitting}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
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
  label: {
    ...typography.label,
    color: colors.neutral700,
    marginBottom: 8,
  },
  lineCard: {
    padding: 14,
    marginBottom: 14,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
  selectedProductText: {
    marginTop: 8,
    marginBottom: 8,
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
  submitWrap: {
    marginTop: 12,
  },
  statusHint: {
    marginTop: 8,
    ...typography.caption,
    color: colors.neutral500,
  },
  totalPreview: {
    ...typography.bodyMedium,
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
});
