import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { listProducts, listStockMovements } from '../api/services';
import { getErrorMessage } from '../api/errors';
import { formatDate } from '../utils/format';
import type { MovementType, ProductResponseDTO, StockMovementResponseDTO } from '../types/api';

interface StocksScreenProps {
  refreshSignal: number;
}

interface ComputedStock {
  available: number;
  consigned: number;
}

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

function movementStyle(type: MovementType) {
  switch (type) {
    case 'ENTREE':
    case 'PRODUCTION':
      return { icon: 'trending-up' as const, color: '#0F766E', background: '#D1FAE5' };
    case 'SORTIE':
    case 'ENVOI':
    case 'MISE_AU_REBUT':
      return { icon: 'trending-down' as const, color: '#DC2626', background: '#FEE2E2' };
    case 'CONSIGNATION_ENTREE':
    case 'CONSIGNATION_SORTIE':
      return { icon: 'refresh-ccw' as const, color: '#7C3AED', background: '#EDE9FE' };
    case 'TRANSFERT':
    default:
      return { icon: 'repeat' as const, color: '#4338CA', background: '#E0E7FF' };
  }
}

export function StocksScreen({ refreshSignal }: StocksScreenProps) {
  const [activeTab, setActiveTab] = useState<'produits' | 'mouvements'>('produits');
  const [query, setQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [movements, setMovements] = useState<StockMovementResponseDTO[]>([]);

  const loadStockData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [fetchedProducts, fetchedMovements] = await Promise.all([
        listProducts(),
        listStockMovements(),
      ]);

      setProducts(fetchedProducts);
      setMovements(fetchedMovements);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStockData();
  }, [loadStockData, refreshSignal]);

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
    const lower = query.toLowerCase();
    return products.filter((product) => product.name.toLowerCase().includes(lower));
  }, [products, query]);

  const sortedMovements = useMemo(() => {
    return [...movements].sort((left, right) => {
      const leftDate = left.date ? new Date(left.date).getTime() : 0;
      const rightDate = right.date ? new Date(right.date).getTime() : 0;
      return rightDate - leftDate;
    });
  }, [movements]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestion de stock</Text>
        <Text style={styles.subtitle}>GET /products + GET /stock-movements</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tabButton, activeTab === 'produits' && styles.tabButtonActive]}
          onPress={() => setActiveTab('produits')}
        >
          <Text style={[styles.tabLabel, activeTab === 'produits' && styles.tabLabelActive]}>Produits</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'mouvements' && styles.tabButtonActive]}
          onPress={() => setActiveTab('mouvements')}
        >
          <Text style={[styles.tabLabel, activeTab === 'mouvements' && styles.tabLabelActive]}>Mouvements</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color='#4338CA' />
          <Text style={styles.centeredText}>Chargement stock...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Erreur stock</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadStockData()}>
            <Text style={styles.retryText}>Reessayer</Text>
          </Pressable>
        </View>
      ) : activeTab === 'produits' ? (
        <View style={styles.section}>
          <View style={styles.searchBox}>
            <Feather name='search' size={18} color='#9CA3AF' style={styles.searchIcon} />
            <TextInput
              placeholder='Rechercher un produit...'
              placeholderTextColor='#9CA3AF'
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.list}>
            {filteredProducts.map((product) => {
              const stock = stockByProduct.get(product.id) ?? { available: 0, consigned: 0 };
              return (
                <View key={product.id} style={styles.card}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>Categorie: {product.categoryName ?? '-'}</Text>

                  <View style={styles.cardGrid}>
                    <View>
                      <Text style={styles.gridLabel}>Stock calcule</Text>
                      <Text style={styles.gridValue}>{stock.available}</Text>
                    </View>
                    <View>
                      <Text style={styles.gridLabel}>Consignation calculee</Text>
                      <Text style={styles.gridValue}>{stock.consigned}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.list}>
            {sortedMovements.map((movement) => {
              const iconStyle = movementStyle(movement.type);
              const sign = movement.type.includes('SORTIE') || movement.type === 'SORTIE' || movement.type === 'ENVOI' || movement.type === 'MISE_AU_REBUT' ? '-' : '+';
              return (
                <View key={movement.id} style={styles.card}>
                  <View style={styles.movementHeader}>
                    <View style={[styles.iconBubble, { backgroundColor: iconStyle.background }]}>
                      <Feather name={iconStyle.icon} size={18} color={iconStyle.color} />
                    </View>
                    <View style={styles.movementText}>
                      <Text style={styles.productName}>Produit: {movement.productId}</Text>
                      <Text style={styles.productMeta}>{movement.reason || movement.source || '-'}</Text>
                    </View>
                    <Text style={styles.movementQty}>
                      {sign}
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
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 96,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabLabelActive: {
    color: '#4338CA',
  },
  section: {
    marginTop: 4,
  },
  searchBox: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    top: 14,
  },
  searchInput: {
    paddingVertical: 12,
    paddingLeft: 44,
    paddingRight: 16,
    fontSize: 16,
    color: '#111827',
  },
  centered: {
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
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
  list: {
    marginTop: 4,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  productMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  cardGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  gridLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  gridValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  movementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBubble: {
    padding: 10,
    borderRadius: 12,
    marginRight: 12,
  },
  movementText: {
    flex: 1,
  },
  movementQty: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
});
