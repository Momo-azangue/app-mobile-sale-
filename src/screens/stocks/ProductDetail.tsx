import { ComponentProps, useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  createProductVariant,
  createStockMovement,
  deleteProductVariant,
  getProduct,
  listProductUnits,
  listProductVariants,
  listProviders,
  listStockMovementsByProduct,
  updateProductVariant,
} from '../../api/services';
import { getErrorMessage } from '../../api/errors';
import { useFormatCurrency } from '../../context/AppSettingsContext';
import { formatDate } from '../../utils/format';
import type {
  MovementType,
  ProductResponseDTO,
  ProductUnitResponseDTO,
  ProductVariantRequestDTO,
  ProductVariantResponseDTO,
  ProviderResponseDTO,
  StockMovementResponseDTO,
} from '../../types/api';
import { colors, radius, shadows } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { AppButton } from '../../components/common/AppButton';
import { ErrorState } from '../../components/common/ErrorState';
import { SkeletonList } from '../../components/common/SkeletonList';
import { useToast } from '../../components/common/ToastProvider';
import { useCachedResource } from '../../hooks/useCachedResource';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { VariantFormModal } from './VariantFormModal';

interface ProductDetailScreenProps {
  productId: string;
  refreshSignal: number;
  highlightedVariantId?: string | null;
  onBack: () => void;
}

type SectionResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface ProductDetailData {
  product: ProductResponseDTO;
  variants: SectionResult<ProductVariantResponseDTO[]>;
  units: SectionResult<ProductUnitResponseDTO[]>;
  movements: SectionResult<StockMovementResponseDTO[]>;
  providers: ProviderResponseDTO[];
}

interface MovementVisual {
  icon: ComponentProps<typeof Feather>['name'];
  color: string;
  background: string;
  sign: '+' | '-' | '~';
}

const RECENT_MOVEMENTS_LIMIT = 20;
const SERIAL_PREVIEW_LIMIT = 16;

async function safeCall<T>(loader: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { ok: true, value: await loader() };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
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

function variantSubtitle(variant: ProductVariantResponseDTO): string {
  const attributes = Object.entries(variant.attributes ?? {})
    .map(([, value]) => value.trim())
    .filter(Boolean);
  return attributes.length ? attributes.join(' • ') : 'Reference simple';
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

export function ProductDetailScreen({
  productId,
  refreshSignal,
  highlightedVariantId,
  onBack,
}: ProductDetailScreenProps) {
  const fmtCurrency = useFormatCurrency();
  const toast = useToast();
  const [variantModalVisible, setVariantModalVisible] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariantResponseDTO | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);

  const fetchDetail = useCallback(async (): Promise<ProductDetailData> => {
    const product = await getProduct(productId);
    const [variants, units, movements, providers] = await Promise.all([
      safeCall(() => listProductVariants(productId)),
      product.trackingMode === 'SERIAL'
        ? safeCall(() => listProductUnits({ productId }))
        : Promise.resolve<SectionResult<ProductUnitResponseDTO[]>>({ ok: true, value: [] }),
      safeCall(() => listStockMovementsByProduct(productId)),
      listProviders().catch(() => [] as ProviderResponseDTO[]),
    ]);
    return { product, variants, units, movements, providers };
  }, [productId]);

  const { data, loading, error, reload } = useCachedResource({
    key: `screen.product-detail:${productId}`,
    fetcher: fetchDetail,
    refreshSignal,
  });
  const { refreshing, onRefresh } = usePullToRefresh(() => reload('silent'));

  const openCreateVariant = () => {
    setEditingVariant(null);
    setVariantModalVisible(true);
  };

  const openEditVariant = (variant: ProductVariantResponseDTO) => {
    setEditingVariant(variant);
    setVariantModalVisible(true);
  };

  const closeVariantModal = () => {
    setVariantModalVisible(false);
    setEditingVariant(null);
  };

  const handleSaveVariant = async (dataToSave: {
    payload: ProductVariantRequestDTO;
    initialStock: number;
  }) => {
    if (!data) {
      return;
    }
    setSavingVariant(true);
    try {
      if (editingVariant) {
        await updateProductVariant(productId, editingVariant.id, dataToSave.payload);
      } else {
        const created = await createProductVariant(productId, {
          ...dataToSave.payload,
          stock: 0,
        });
        if (dataToSave.initialStock > 0) {
          const consigned = Boolean(dataToSave.payload.consignment);
          await createStockMovement({
            productId,
            variantId: created.id,
            quantity: dataToSave.initialStock,
            type: consigned ? 'CONSIGNATION_ENTREE' : 'ENTREE',
            providerId: consigned ? dataToSave.payload.providerId : undefined,
            unitPurchasePrice: consigned ? dataToSave.payload.providerPrice : undefined,
            date: new Date().toISOString(),
          });
        }
      }
      closeVariantModal();
      await reload('silent');
      toast.success(editingVariant ? 'Variante mise a jour.' : 'Variante creee.');
    } catch (saveError) {
      Alert.alert('Erreur', getErrorMessage(saveError));
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeleteVariant = (variant: ProductVariantResponseDTO) => {
    Alert.alert('Supprimer la variante', `Supprimer ${variantLabel(variant)} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProductVariant(productId, variant.id);
            await reload('silent');
            toast.success('Variante supprimee.');
          } catch (deleteError) {
            Alert.alert('Erreur', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  if (loading) {
    return <SkeletonList variant='detail' count={5} />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title='Produit introuvable'
        message={error ?? 'Donnees indisponibles'}
        onRetry={() => void reload('blocking')}
      />
    );
  }

  const { product, variants, units, movements, providers } = data;
  const isSerial = product.trackingMode === 'SERIAL';
  const allVariants = variants.ok ? variants.value : [];
  const totalQuantity = allVariants.reduce((sum, variant) => sum + variant.quantity, 0);
  const totalConsigned = allVariants.reduce((sum, variant) => sum + variant.consignedQuantity, 0);
  const lowStockCount = allVariants.filter(
    (variant) => variant.minStock > 0 && variant.quantity <= variant.minStock,
  ).length;
  const inStockUnits = units.ok ? units.value.filter((unit) => unit.status === 'IN_STOCK') : [];
  const unitsByVariant = new Map<string, ProductUnitResponseDTO[]>();
  if (units.ok) {
    units.value.forEach((unit) => {
      const current = unitsByVariant.get(unit.variantId) ?? [];
      current.push(unit);
      unitsByVariant.set(unit.variantId, current);
    });
  }
  const recentMovements = movements.ok
    ? [...movements.value]
        .sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, RECENT_MOVEMENTS_LIMIT)
    : [];

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10} accessibilityLabel='Retour'>
          <Feather name='arrow-left' size={20} color={colors.neutral800} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {[product.brand, product.categoryName].filter(Boolean).join(' • ') || 'Modele produit'}
          </Text>
        </View>
        <View style={styles.badges}>
          <Badge tone={isSerial ? 'info' : 'neutral'} label={isSerial ? 'IMEI' : 'Standard'} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />}
      >
        <View style={styles.kpiGrid}>
          <KPI label='Stock propre' value={String(totalQuantity)} tone={lowStockCount > 0 ? 'danger' : 'neutral'} />
          <KPI label='Stock consigne' value={String(totalConsigned)} tone={totalConsigned > 0 ? 'warning' : 'neutral'} />
          <KPI label='Variantes' value={String(allVariants.length)} tone='neutral' />
          <KPI label='Alertes' value={String(lowStockCount)} tone={lowStockCount > 0 ? 'danger' : 'neutral'} />
        </View>

        <Section title='Details'>
          <DetailRow label='Categorie' value={product.categoryName ?? '-'} />
          <DetailRow label='SKU modele' value={product.sku ?? '-'} />
          <DetailRow label='Code-barres modele' value={product.barcode ?? '-'} />
          <DetailRow label='Prix reference' value={product.price != null ? fmtCurrency(product.price) : '-'} />
          <DetailRow label='Mode de suivi' value={isSerial ? 'IMEI / numero de serie' : 'Quantite simple'} />
        </Section>

        <Section
          title='Variantes'
          subtitle={`${allVariants.length} reference${allVariants.length > 1 ? 's' : ''} vendable${allVariants.length > 1 ? 's' : ''}`}
          action={<AppButton label='Ajouter une variante' variant='outline' onPress={openCreateVariant} />}
        >
          {!variants.ok ? (
            <Text style={styles.unavailable}>Variantes indisponibles : {variants.error}</Text>
          ) : allVariants.length === 0 ? (
            <Text style={styles.empty}>Aucune variante. Ajoutez une variante pour vendre ce modele.</Text>
          ) : (
            <View style={styles.variantList}>
              {allVariants.map((variant) => {
                const highlighted = highlightedVariantId === variant.id;
                const serialPreview = (unitsByVariant.get(variant.id) ?? [])
                  .filter((unit) => unit.status === 'IN_STOCK')
                  .slice(0, 4);
                return (
                  <View key={variant.id} style={[styles.variantCard, highlighted && styles.variantCardHighlighted]}>
                    <View style={styles.variantTop}>
                      <View style={styles.variantTitleWrap}>
                        <Text style={styles.variantName}>{variantLabel(variant)}</Text>
                        <Text style={styles.variantSubtitle}>{variantSubtitle(variant)}</Text>
                      </View>
                      <View style={styles.variantActions}>
                        <Pressable onPress={() => openEditVariant(variant)} hitSlop={8}>
                          <Feather name='edit-2' size={17} color={colors.neutral600} />
                        </Pressable>
                        <Pressable onPress={() => handleDeleteVariant(variant)} hitSlop={8}>
                          <Feather name='trash-2' size={17} color={colors.danger600} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.badgeRow}>
                      <InlineBadge label={`Stock ${variant.quantity}`} tone='neutral' />
                      {variant.consignedQuantity > 0 ? (
                        <InlineBadge label={`Consigne ${variant.consignedQuantity}`} tone='warning' />
                      ) : null}
                      {variant.minStock > 0 && variant.quantity <= variant.minStock ? (
                        <InlineBadge label={`Alerte ${variant.minStock}`} tone='danger' />
                      ) : null}
                      {variant.consignment ? <InlineBadge label='Consigne' tone='warning' /> : null}
                    </View>
                    <View style={styles.variantMetaGrid}>
                      <DetailRow label='Prix' value={variant.price != null ? fmtCurrency(variant.price) : 'Prix modele'} />
                      <DetailRow label='SKU' value={variant.sku ?? '-'} />
                      <DetailRow label='Code-barres' value={variant.barcode ?? '-'} />
                      <DetailRow label='Fournisseur' value={variant.providerName ?? variant.providerId ?? '-'} />
                    </View>
                    {isSerial && serialPreview.length > 0 ? (
                      <Text style={styles.serialPreview}>
                        IMEI : {serialPreview.map((unit) => unit.serialNumber).join(', ')}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </Section>

        {isSerial ? (
          <Section
            title='Unites disponibles'
            subtitle={`${inStockUnits.length} IMEI en stock`}
          >
            {!units.ok ? (
              <Text style={styles.unavailable}>Unites indisponibles : {units.error}</Text>
            ) : inStockUnits.length === 0 ? (
              <Text style={styles.empty}>Aucune unite disponible.</Text>
            ) : (
              <View style={styles.serialList}>
                {inStockUnits.slice(0, SERIAL_PREVIEW_LIMIT).map((unit) => (
                  <View key={unit.id} style={styles.serialChip}>
                    <Text style={styles.serialText}>{unit.serialNumber}</Text>
                  </View>
                ))}
              </View>
            )}
          </Section>
        ) : null}

        <Section title='Historique mouvements'>
          {!movements.ok ? (
            <Text style={styles.unavailable}>Mouvements indisponibles : {movements.error}</Text>
          ) : recentMovements.length === 0 ? (
            <Text style={styles.empty}>Aucun mouvement pour ce produit.</Text>
          ) : (
            <View style={styles.movementList}>
              {recentMovements.map((movement) => {
                const visual = movementVisual(movement.type);
                const linkedVariant = allVariants.find((variant) => variant.id === movement.variantId);
                return (
                  <View key={movement.id} style={styles.movementRow}>
                    <View style={[styles.iconBubble, { backgroundColor: visual.background }]}>
                      <Feather name={visual.icon} size={16} color={visual.color} />
                    </View>
                    <View style={styles.movementText}>
                      <Text style={styles.movementTitle}>
                        {movement.type} • {linkedVariant ? variantLabel(linkedVariant) : movement.variantId}
                      </Text>
                      <Text style={styles.movementMeta}>
                        {formatDate(movement.date)}
                        {movement.reference ? ` • ${movement.reference}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.movementQty}>
                      {visual.sign}
                      {movement.quantity}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Section>
      </ScrollView>

      <VariantFormModal
        visible={variantModalVisible}
        product={product}
        variant={editingVariant}
        existingVariants={allVariants}
        providers={providers}
        saving={savingVariant}
        onClose={closeVariantModal}
        onSubmit={handleSaveVariant}
      />
    </View>
  );
}

interface KPIProps {
  label: string;
  value: string;
  tone: 'neutral' | 'warning' | 'danger';
}

function KPI({ label, value, tone }: KPIProps) {
  const toneStyle =
    tone === 'danger' ? styles.kpiDanger : tone === 'warning' ? styles.kpiWarning : styles.kpiNeutral;
  return (
    <View style={[styles.kpi, toneStyle]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, subtitle, action, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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

function InlineBadge({ label, tone }: { label: string; tone: 'neutral' | 'warning' | 'danger' }) {
  const style =
    tone === 'danger' ? styles.inlineBadgeDanger : tone === 'warning' ? styles.inlineBadgeWarning : styles.inlineBadgeNeutral;
  return (
    <View style={[styles.inlineBadge, style]}>
      <Text style={styles.inlineBadgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.h2,
    color: colors.neutral900,
  },
  subtitle: {
    ...typography.caption,
    color: colors.neutral500,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpi: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
  },
  kpiNeutral: {
    backgroundColor: colors.white,
    borderColor: colors.neutral200,
  },
  kpiWarning: {
    backgroundColor: colors.warning100,
    borderColor: colors.warning100,
  },
  kpiDanger: {
    backgroundColor: colors.danger100,
    borderColor: colors.danger100,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.neutral600,
  },
  kpiValue: {
    ...typography.h2,
    color: colors.neutral900,
    marginTop: 4,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    padding: 14,
    gap: 12,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.neutral500,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.neutral500,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.neutral800,
    flexShrink: 1,
    textAlign: 'right',
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  variantList: {
    gap: 10,
  },
  variantCard: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radius.md,
    backgroundColor: colors.neutral50,
    padding: 12,
    gap: 10,
  },
  variantCardHighlighted: {
    borderColor: colors.primary600,
    backgroundColor: colors.primary50,
  },
  variantTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  variantTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  variantName: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  variantSubtitle: {
    ...typography.caption,
    color: colors.neutral500,
  },
  variantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  inlineBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  inlineBadgeNeutral: {
    backgroundColor: colors.neutral100,
  },
  inlineBadgeWarning: {
    backgroundColor: colors.warning100,
  },
  inlineBadgeDanger: {
    backgroundColor: colors.danger100,
  },
  inlineBadgeText: {
    ...typography.caption,
    color: colors.neutral800,
  },
  variantMetaGrid: {
    gap: 4,
  },
  serialPreview: {
    ...typography.caption,
    color: colors.neutral600,
  },
  serialList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serialChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.neutral100,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  serialText: {
    ...typography.caption,
    color: colors.neutral800,
  },
  movementList: {
    gap: 10,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: radius.md,
    padding: 10,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movementText: {
    flex: 1,
    minWidth: 0,
  },
  movementTitle: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  movementMeta: {
    ...typography.caption,
    color: colors.neutral500,
  },
  movementQty: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  unavailable: {
    ...typography.caption,
    color: colors.danger600,
  },
  empty: {
    ...typography.caption,
    color: colors.neutral500,
  },
});
