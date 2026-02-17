import { ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { listProducts, listStockMovements } from '../api/services';
import { getErrorMessage } from '../api/errors';
import { formatDate } from '../utils/format';
import type { MovementType, ProductResponseDTO, StockMovementResponseDTO } from '../types/api';
import { colors, radius, shadows } from '../theme/tokens';
import { typography } from '../theme/typography';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SearchField } from '../components/common/SearchField';

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
  const [query, setQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductResponseDTO[]>([]);
  const [movements, setMovements] = useState<StockMovementResponseDTO[]>([]);

  const loadStockData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [fetchedProducts, fetchedMovements] = await Promise.all([listProducts(), listStockMovements()]);
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

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

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

  if (loading) {
    return <LoadingState message='Chargement stock...' />;
  }

  if (error) {
    return <ErrorState title='Erreur stock' message={error} onRetry={() => void loadStockData()} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title='Gestion de stock' subtitle='Suivi produits et mouvements' />

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

      {activeTab === 'produits' ? (
        <>
          <View style={styles.searchBox}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder='Rechercher un produit...'
            />
          </View>

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
                      <Text style={styles.productName}>{product.name}</Text>
                      <View style={styles.categoryChip}>
                        <Text style={styles.categoryText}>{product.categoryName ?? 'Sans categorie'}</Text>
                      </View>
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
      ) : sortedMovements.length === 0 ? (
        <EmptyState
          icon='repeat'
          title='Aucun mouvement'
          description='Les mouvements de stock apparaitront ici.'
        />
      ) : (
        <View style={styles.list}>
          {sortedMovements.map((movement) => {
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  content: {
    paddingBottom: 96,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.neutral100,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  tabLabel: {
    ...typography.label,
    color: colors.neutral600,
  },
  tabLabelActive: {
    color: colors.primary600,
  },
  searchBox: {
    marginBottom: 16,
  },
  list: {
    gap: 12,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  productName: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  categoryChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary50,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
});
