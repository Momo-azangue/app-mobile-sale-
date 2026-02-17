import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createSale, listClients, listProducts } from '../api/services';
import { getErrorMessage } from '../api/errors';
import type { ClientResponseDTO, InvoiceStatus, ProductResponseDTO, SaleRequestDTO } from '../types/api';

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

  const productById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

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
      (line) => !line.productId || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.priceAtSale) || line.priceAtSale <= 0
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator color='#4338CA' />
        <Text style={styles.centeredText}>Chargement references...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Erreur references</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => void loadReferences()}>
          <Text style={styles.retryText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backLabel}>Retour</Text>
      </Pressable>

      <Text style={styles.title}>Nouvelle vente</Text>
      <Text style={styles.subtitle}>POST /sales</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Client</Text>
        <View style={styles.chipsWrap}>
          {clients.map((client) => {
            const active = client.id === clientId;
            return (
              <Pressable
                key={client.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setClientId(client.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{client.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Statut facture</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((option) => {
            const isActive = status === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setStatus(option.value)}
                style={[styles.statusChip, isActive && styles.statusChipActive]}
              >
                <Text style={[styles.statusLabel, isActive && styles.statusLabelActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {lines.map((line, index) => {
        const selectedProduct = productById.get(line.productId);
        return (
          <View key={line.id} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineTitle}>Ligne {index + 1}</Text>
              <Pressable onPress={() => removeLine(line.id)} disabled={lines.length === 1}>
                <Text style={[styles.removeText, lines.length === 1 && styles.removeDisabled]}>Supprimer</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Produit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productChips}>
              {products.map((product) => {
                const active = product.id === line.productId;
                return (
                  <Pressable
                    key={`${line.id}-${product.id}`}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => updateLine(line.id, { productId: product.id })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{product.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.selectedProductText}>Selection: {selectedProduct?.name ?? '-'}</Text>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.flexHalf]}>
                <Text style={styles.label}>Quantite</Text>
                <TextInput
                  style={styles.input}
                  value={line.quantity}
                  onChangeText={(value) => updateLine(line.id, { quantity: value })}
                  keyboardType='numeric'
                  placeholder='1'
                  placeholderTextColor='#9CA3AF'
                />
              </View>
              <View style={[styles.formGroup, styles.flexHalf]}>
                <Text style={styles.label}>Prix vente</Text>
                <TextInput
                  style={styles.input}
                  value={line.priceAtSale}
                  onChangeText={(value) => updateLine(line.id, { priceAtSale: value })}
                  keyboardType='decimal-pad'
                  placeholder='100'
                  placeholderTextColor='#9CA3AF'
                />
              </View>
            </View>
          </View>
        );
      })}

      <Pressable style={styles.secondaryButton} onPress={addLine}>
        <Text style={styles.secondaryButtonText}>Ajouter une ligne</Text>
      </Pressable>

      <Pressable style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitLabel}>{submitting ? 'Creation...' : 'Enregistrer la vente'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 48,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
  },
  centeredText: {
    color: '#6B7280',
  },
  errorTitle: {
    fontWeight: '700',
    color: '#B91C1C',
  },
  errorText: {
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E0E7FF',
  },
  retryText: {
    color: '#4338CA',
    fontWeight: '700',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  backLabel: {
    color: '#374151',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 20,
    fontSize: 14,
    color: '#6B7280',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    borderColor: '#4338CA',
    backgroundColor: '#EEF2FF',
  },
  chipText: {
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#4338CA',
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  statusChipActive: {
    backgroundColor: '#4338CA',
    borderColor: '#4338CA',
  },
  statusLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  statusLabelActive: {
    color: '#FFFFFF',
  },
  lineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  removeText: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  removeDisabled: {
    opacity: 0.5,
  },
  productChips: {
    paddingBottom: 4,
  },
  selectedProductText: {
    marginTop: 8,
    marginBottom: 8,
    color: '#6B7280',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  flexHalf: {
    flex: 1,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#4338CA',
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#4338CA',
    fontWeight: '700',
  },
  submitButton: {
    borderRadius: 999,
    paddingVertical: 16,
    backgroundColor: '#4338CA',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
