import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createSale, listClients, listProducts } from '../api/services';
import { getErrorMessage } from '../api/errors';
import type { ClientResponseDTO, InvoiceStatus, ProductResponseDTO, SaleRequestDTO } from '../types/api';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { AppButton } from '../components/common/AppButton';
import { AppCard } from '../components/common/AppCard';
import { ChipGroup, type ChipOption } from '../components/common/ChipGroup';
import { InputField } from '../components/common/InputField';

interface NouvelleVenteProps {
  onBack: () => void;
  onCreated: () => void;
  refreshSignal: number;
}

interface SaleLineForm {
  id: string;
  productId: string;
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

  const [clients, setClients] = useState<ClientResponseDTO[]>([]);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);

  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('IMPAYE');
  const [lines, setLines] = useState<SaleLineForm[]>([
    { id: nextLineId(), productId: '', quantity: '1', priceAtSale: '' },
  ]);

  const loadReferences = useCallback(async () => {
    setLoading(true);
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
    void loadReferences();
  }, [loadReferences, refreshSignal]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const clientOptions = useMemo<ChipOption[]>(
    () => clients.map((client) => ({ label: client.name, value: client.id })),
    [clients],
  );
  const statusOptions = useMemo<ChipOption[]>(
    () => STATUS_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );
  const productOptions = useMemo<ChipOption[]>(
    () => products.map((product) => ({ label: product.name, value: product.id })),
    [products],
  );

  const updateLine = (lineId: string, patch: Partial<SaleLineForm>) => {
    setLines((previous) => previous.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    setLines((previous) => [...previous, { id: nextLineId(), productId: '', quantity: '1', priceAtSale: '' }]);
  };

  const removeLine = (lineId: string) => {
    setLines((previous) => (previous.length > 1 ? previous.filter((line) => line.id !== lineId) : previous));
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

    return {
      clientId,
      products: mappedProducts,
      date: new Date().toISOString(),
      invoiceStatus: status,
    };
  };

  const handleSubmit = async () => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    setSubmitting(true);
    try {
      await createSale(payload);
      Alert.alert('Succes', 'Vente creee avec succes.', [
        {
          text: 'OK',
          onPress: () => {
            onCreated();
            onBack();
          },
        },
      ]);
    } catch (submitError) {
      Alert.alert('Erreur creation vente', getErrorMessage(submitError));
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backLabel}>Retour</Text>
      </Pressable>

      <ScreenHeader title='Nouvelle vente' subtitle='Creation d une vente et generation de facture' />

      <View style={styles.formGroup}>
        <Text style={styles.label}>Client</Text>
        <ChipGroup options={clientOptions} value={clientId} onChange={setClientId} layout='wrap' tone='soft' />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Statut facture</Text>
        <ChipGroup
          options={statusOptions}
          value={status}
          onChange={(value) => setStatus(value as InvoiceStatus)}
          layout='wrap'
          tone='solid'
        />
      </View>

      {lines.map((line, index) => {
        const selectedProduct = productById.get(line.productId);
        return (
          <AppCard key={line.id} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineTitle}>Ligne {index + 1}</Text>
              <Pressable onPress={() => removeLine(line.id)} disabled={lines.length === 1}>
                <Text style={[styles.removeText, lines.length === 1 && styles.removeDisabled]}>Supprimer</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Produit</Text>
            <ChipGroup
              options={productOptions}
              value={line.productId}
              onChange={(value) => updateLine(line.id, { productId: value })}
              layout='row-scroll'
              tone='soft'
            />

            <Text style={styles.selectedProductText}>Selection: {selectedProduct?.name ?? '-'}</Text>

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
});
