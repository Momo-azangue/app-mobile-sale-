import { ComponentProps, useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  getProduct,
  listProductUnits,
  listProductVariants,
  listStockMovementsByProduct,
} from '../../api/services';
import { getErrorMessage } from '../../api/errors';
import { useFormatCurrency } from '../../context/AppSettingsContext';
import { formatDate } from '../../utils/format';
import type {
  MovementType,
  ProductResponseDTO,
  ProductUnitResponseDTO,
  ProductVariantResponseDTO,
  StockMovementResponseDTO,
} from '../../types/api';
import { colors, radius, shadows } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useCachedResource } from '../../hooks/useCachedResource';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

interface ProductDetailScreenProps {
  productId: string;
  refreshSignal: number;
  onBack: () => void;
}

type SectionResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface ProductDetailData {
  product: ProductResponseDTO;
  variants: SectionResult<ProductVariantResponseDTO[]>;
  units: SectionResult<ProductUnitResponseDTO[]>;
  movements: SectionResult<StockMovementResponseDTO[]>;
}

const RECENT_MOVEMENTS_LIMIT = 20;
const SERIAL_PREVIEW_LIMIT = 12;

interface MovementVisual {
  icon: ComponentProps<typeof Feather>['name'];
  color: string;
  background: string;
  sign: '+' | '-' | '~';
}

/**
 * Localement dupliqué depuis StocksScreen pour éviter un coupling cross-fichier
 * — sera factorisé en {@code stocks/helpers.ts} lors du découpage Phase B.3.
 */
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

async function safeCall<T>(loader: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { ok: true, value: await loader() };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export function ProductDetailScreen({ productId, refreshSignal, onBack }: ProductDetailScreenProps) {
  const fmtCurrency = useFormatCurrency();

  const fetchDetail = useCallback(async (): Promise<ProductDetailData> => {
    // Le produit est obligatoire — si /products/{id} échoue on affiche une
    // ErrorState plein écran. Les autres sections sont tolérantes : un échec
    // partiel (ex: /product-units indisponible) n'empêche pas l'affichage.
    const product = await getProduct(productId);
    const [variants, units, movements] = await Promise.all([
      safeCall(() => listProductVariants(productId)),
      product.trackingMode === 'SERIAL'
        ? safeCall(() => listProductUnits({ productId }))
        : Promise.resolve<SectionResult<ProductUnitResponseDTO[]>>({ ok: true, value: [] }),
      safeCall(() => listStockMovementsByProduct(productId)),
    ]);
    return { product, variants, units, movements };
  }, [productId]);

  const { data, loading, error, reload } = useCachedResource({
    key: `screen.product-detail:${productId}`,
    fetcher: fetchDetail,
    refreshSignal,
  });
  const { refreshing, onRefresh } = usePullToRefresh(() => reload('silent'));

  if (loading) {
    return <LoadingState message='Chargement produit...' />;
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

  const { product, variants, units, movements } = data;
  const isSerial = product.trackingMode === 'SERIAL';
  const isConsignment = Boolean(product.consignment);

  const allVariants = variants.ok ? variants.value : [];
  // Une seule variante "default" (name=null) → ne pas l'afficher (UX simple
  // pour les commerçants qui ne gèrent pas de variantes).
  const visibleVariants = allVariants.filter((variant) => variant.name && variant.name.trim().length > 0);
  const showVariantsSection = visibleVariants.length > 0;

  const inStockUnits = units.ok ? units.value.filter((unit) => unit.status === 'IN_STOCK') : [];
  const serialPreview = inStockUnits.slice(0, SERIAL_PREVIEW_LIMIT);
  const serialExtra = inStockUnits.length - serialPreview.length;

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
          {product.brand ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}
        </View>
        <View style={styles.badges}>
          <Badge tone={isSerial ? 'info' : 'neutral'} label={isSerial ? 'IMEI' : 'Standard'} />
          {isConsignment ? <Badge tone='warning' label='Consigné' /> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} />
        }
      >
        {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
        <View style={styles.kpiGrid}>
          <KPI
            label='Stock disponible'
            value={String(product.quantity ?? 0)}
            tone={
              product.minStock != null
              && product.minStock > 0
              && (product.quantity ?? 0) <= product.minStock
                ? 'danger'
                : 'neutral'
            }
          />
          {isConsignment ? (
            <KPI label='Stock consigne' value={String(product.consignedQuantity ?? 0)} tone='warning' />
          ) : null}
          <KPI label='Seuil minimum' value={String(product.minStock ?? 0)} tone='neutral' />
          <KPI
            label='Prix de vente'
            value={product.price != null ? fmtCurrency(product.price) : '—'}
            tone='neutral'
          />
        </View>

        {/* ── Détails identité ──────────────────────────────────────────────────── */}
        <Section title='Détails'>
          <DetailRow label='Catégorie' value={product.categoryName ?? '—'} />
          <DetailRow label='SKU' value={product.sku ?? '—'} />
          <DetailRow label='Code-barres' value={product.barcode ?? '—'} />
          <DetailRow label='Mode de suivi' value={isSerial ? 'IMEI / Numéro de série' : 'Quantité simple'} />
          {product.createdAt ? (
            <DetailRow label='Créé le' value={formatDate(product.createdAt)} />
          ) : null}
        </Section>

        {/* ── Fournisseur (si consigné) ─────────────────────────────────────────── */}
        {isConsignment && product.providerId ? (
          <Section title='Origine fournisseur'>
            <DetailRow label='Fournisseur' value={product.providerName ?? product.providerId} />
            {product.providerPrice != null ? (
              <DetailRow label="Prix d'achat" value={fmtCurrency(product.providerPrice)} />
            ) : null}
          </Section>
        ) : null}

        {/* ── Variantes ─────────────────────────────────────────────────────────── */}
        {showVariantsSection ? (
          <Section
            title='Variantes'
            subtitle={`${visibleVariants.length} variante${visibleVariants.length > 1 ? 's' : ''}`}
          >
            {visibleVariants.map((variant) => (
              <View key={variant.id} style={styles.variantRow}>
                <View style={styles.variantHeader}>
                  <Text style={styles.variantName}>{variant.name}</Text>
                  {variant.price != null ? (
                    <Text style={styles.variantPrice}>{fmtCurrency(variant.price)}</Text>
                  ) : null}
                </View>
                <Text style={styles.variantMeta}>
                  Stock : {variant.stock}
                  {variant.sku ? ` · SKU ${variant.sku}` : ''}
                  {variant.barcode ? ` · ${variant.barcode}` : ''}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {/* ── Unités IMEI / SERIAL ──────────────────────────────────────────────── */}
        {isSerial ? (
          <Section
            title='Unités en stock'
            subtitle={
              units.ok
                ? `${inStockUnits.length} unité${inStockUnits.length > 1 ? 's' : ''} disponible${inStockUnits.length > 1 ? 's' : ''}`
                : undefined
            }
          >
            {!units.ok ? (
              <Text style={styles.unavailable}>Données unités indisponibles — {units.error}</Text>
            ) : inStockUnits.length === 0 ? (
              <Text style={styles.empty}>Aucune unité en stock pour ce produit.</Text>
            ) : (
              <View style={styles.serialList}>
                {serialPreview.map((unit) => (
                  <View key={unit.id} style={styles.serialChip}>
                    <Feather name='hash' size={12} color={colors.neutral500} />
                    <Text style={styles.serialText} numberOfLines={1}>
                      {unit.serialNumber}
                    </Text>
                  </View>
                ))}
                {serialExtra > 0 ? (
                  <Text style={styles.serialExtra}>{`+ ${serialExtra} autres`}</Text>
                ) : null}
              </View>
            )}
          </Section>
        ) : null}

        {/* ── Historique mouvements ─────────────────────────────────────────────── */}
        <Section title='Historique mouvements'>
          {!movements.ok ? (
            <Text style={styles.unavailable}>Historique indisponible — {movements.error}</Text>
          ) : recentMovements.length === 0 ? (
            <Text style={styles.empty}>Aucun mouvement enregistré pour ce produit.</Text>
          ) : (
            <View style={styles.movementsList}>
              {recentMovements.map((movement) => {
                const visual = movementVisual(movement.type);
                return (
                  <View key={movement.id} style={styles.movementRow}>
                    <View style={[styles.movementIcon, { backgroundColor: visual.background }]}>
                      <Feather name={visual.icon} size={16} color={visual.color} />
                    </View>
                    <View style={styles.movementBody}>
                      <Text style={styles.movementType}>
                        {labelMovement(movement.type)}
                        {movement.source ? ` · ${labelSource(movement.source)}` : ''}
                      </Text>
                      <Text style={styles.movementMeta}>
                        {formatDate(movement.date) || '—'}
                        {movement.reference ? ` · ${movement.reference}` : ''}
                      </Text>
                      {movement.reason ? (
                        <Text style={styles.movementMeta} numberOfLines={2}>
                          {movement.reason}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.movementQty, { color: visual.color }]}>
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
    </View>
  );
}

// ── Sous-composants locaux ───────────────────────────────────────────────────

interface KPIProps {
  label: string;
  value: string;
  tone: 'neutral' | 'warning' | 'danger';
}

function KPI({ label, value, tone }: KPIProps) {
  const toneStyle =
    tone === 'danger' ? styles.kpiDanger : tone === 'warning' ? styles.kpiWarning : styles.kpiNeutral;
  return (
    <View style={[styles.kpiCard, toneStyle]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

interface BadgeProps {
  label: string;
  tone: 'info' | 'warning' | 'neutral';
}

function Badge({ label, tone }: BadgeProps) {
  const palette =
    tone === 'info'
      ? { bg: colors.primary100, fg: colors.primary600 }
      : tone === 'warning'
      ? { bg: colors.warning100, fg: colors.warning600 }
      : { bg: colors.neutral100, fg: colors.neutral700 };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

// ── Libellés affichables pour les enums backend ──────────────────────────────

function labelMovement(type: MovementType): string {
  switch (type) {
    case 'ENTREE':
      return 'Entrée';
    case 'SORTIE':
      return 'Sortie';
    case 'TRANSFERT':
      return 'Transfert';
    case 'ENVOI':
      return 'Envoi';
    case 'PRODUCTION':
      return 'Production';
    case 'MISE_AU_REBUT':
      return 'Mise au rebut';
    case 'CONSIGNATION_ENTREE':
      return 'Consignation +';
    case 'CONSIGNATION_SORTIE':
      return 'Consignation -';
    default:
      return type;
  }
}

function labelSource(source: string): string {
  switch (source) {
    case 'VENTE':
      return 'Vente';
    case 'RETOUR_CLIENT':
      return 'Retour client';
    case 'COMMANDE_FOURNISSEUR':
      return 'Commande fournisseur';
    case 'AJUSTEMENT':
      return 'Ajustement';
    case 'TRANSFERT':
      return 'Transfert';
    case 'SAV':
      return 'SAV';
    case 'PRODUCTION':
      return 'Production';
    case 'DESTRUCTION':
      return 'Destruction';
    case 'CONSIGNATION':
      return 'Consignation';
    default:
      return source;
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral200,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
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
    marginTop: 2,
  },
  badges: {
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.captionMedium,
  },
  content: {
    padding: 16,
    paddingBottom: 80,
    gap: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  kpiNeutral: {
    borderColor: colors.neutral200,
  },
  kpiWarning: {
    borderColor: colors.warning600,
    backgroundColor: colors.warning100,
  },
  kpiDanger: {
    borderColor: colors.danger600,
    backgroundColor: colors.danger100,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.neutral600,
  },
  kpiValue: {
    marginTop: 6,
    ...typography.h2,
    color: colors.neutral900,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
    overflow: 'hidden',
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.neutral900,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.neutral500,
  },
  sectionBody: {
    padding: 16,
    paddingTop: 8,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 12,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.neutral500,
    flexShrink: 0,
  },
  detailValue: {
    ...typography.label,
    color: colors.neutral900,
    flex: 1,
    textAlign: 'right',
  },
  variantRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral200,
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  variantName: {
    ...typography.label,
    color: colors.neutral900,
  },
  variantPrice: {
    ...typography.label,
    color: colors.primary600,
  },
  variantMeta: {
    marginTop: 2,
    ...typography.caption,
    color: colors.neutral500,
  },
  serialList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.neutral100,
    borderRadius: radius.pill,
  },
  serialText: {
    ...typography.caption,
    color: colors.neutral800,
    maxWidth: 140,
  },
  serialExtra: {
    ...typography.caption,
    color: colors.neutral500,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  movementsList: {
    gap: 12,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  movementIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movementBody: {
    flex: 1,
    gap: 2,
  },
  movementType: {
    ...typography.label,
    color: colors.neutral900,
  },
  movementMeta: {
    ...typography.caption,
    color: colors.neutral500,
  },
  movementQty: {
    ...typography.bodyMedium,
    minWidth: 48,
    textAlign: 'right',
  },
  unavailable: {
    ...typography.caption,
    color: colors.neutral500,
    fontStyle: 'italic',
  },
  empty: {
    ...typography.caption,
    color: colors.neutral500,
    fontStyle: 'italic',
  },
});
