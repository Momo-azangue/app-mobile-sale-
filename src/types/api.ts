// RFC 7807 Problem Details (application/problem+json) — format renvoyé par le backend.
export interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  timestamp?: string;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface LogoutRequestDTO {
  refreshToken: string;
}

export interface TenantResponseDTO {
  id: string;
  name: string;
  planId?: string;
  subscriptionEndDate?: string | null;
  emailContact?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantPlanInfoDTO {
  tenantId: string;
  planId?: string;
  planName?: string;
  maxUsers?: number;
  maxProducts?: number;
  currentUserCount?: number;
  currentProductCount?: number;
  subscriptionEndDate?: string | null;
}

export interface ChangePlanRequestDTO {
  planId: string;
}

export interface AuthResponseDTO {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn?: number;
  name?: string;
  email: string;
  role: string;
  tenantId: string;
}

export interface ForgotPasswordRequestDTO {
  email: string;
}

export interface ResetPasswordRequestDTO {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequestDTO {
  email: string;
}

export interface VerifyEmailConfirmRequestDTO {
  token: string;
}

export interface UserRequestDTO {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'EMPLOYE';
}

export interface TenantRequestDTO {
  name: string;
  planId: string;
  subscriptionEndDate: string | null;
  emailContact?: string;
}

export interface RegisterRequestDTO {
  user: UserRequestDTO;
  tenant: TenantRequestDTO;
}

export type UserRole = 'ADMIN' | 'EMPLOYE';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'REVOKED';

export interface UserResponseDTO {
  id?: string;
  name?: string;
  email: string;
  role: UserRole | string;
  status?: UserStatus;
  statusChangedAt?: string;
  statusReason?: string;
}

export interface UserStatusUpdateRequestDTO {
  status: UserStatus;
  reason?: string;
}

export interface SubscriptionPlanDTO {
  id: string;
  name: string;
  price?: number;
  maxUsers?: number;
  maxProducts?: number;
  active?: boolean;
  period?: string;
  durationInMonths?: number | null;
  description?: string;
}

export interface ClientResponseDTO {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface ClientRequestDTO {
  name: string;
  email?: string;
  phone?: string;
}

export interface ProviderResponseDTO {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  conditionsPaiement?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProviderRequestDTO {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CategoryResponseDTO {
  id: string;
  nom: string;
  description?: string;
}

export interface CategoryRequestDTO {
  nom: string;
  description?: string;
}

export type InvitationRole = 'ADMIN' | 'EMPLOYE';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';

export interface InviteUserRequestDTO {
  email: string;
  role: InvitationRole;
}

export interface InvitationResponseDTO {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  createdAt?: string;
  expiresAt?: string;
}

export type TrackingMode = 'NONE' | 'SERIAL';
export type ProductUnitStatus = 'IN_STOCK' | 'SOLD' | 'RETURNED' | 'DAMAGED' | 'LOST';

export interface ProductResponseDTO {
  id: string;
  name: string;
  brand?: string;
  sku?: string;
  barcode?: string;
  price?: number;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  trackingMode?: TrackingMode;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductRequestDTO {
  name: string;
  brand?: string;
  sku?: string;
  barcode?: string;
  price: number;
  description?: string;
  categoryId: string;
  trackingMode?: TrackingMode;
}

export interface ProductVariantResponseDTO {
  id: string;
  productId: string;
  productName?: string;
  productBrand?: string;
  productTrackingMode?: TrackingMode;
  categoryId?: string;
  categoryName?: string;
  name?: string;
  sku?: string;
  barcode?: string;
  attributes?: Record<string, string>;
  price?: number;
  quantity: number;
  /** @deprecated Alias backend temporaire. Utiliser quantity. */
  stock?: number;
  minStock: number;
  consignedQuantity: number;
  consignment: boolean;
  providerId?: string;
  providerName?: string;
  providerPrice?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariantRequestDTO {
  name?: string;
  sku?: string;
  barcode?: string;
  attributes?: Record<string, string>;
  price?: number;
  /** Alias backend temporaire pour quantity lors de la création. */
  stock?: number;
  minStock?: number;
  consignment?: boolean;
  providerId?: string;
  providerPrice?: number;
}

export interface LowStockEntryResponseDTO {
  productId: string;
  productName: string;
  variantId: string;
  variantLabel?: string;
  quantity: number;
  minStock: number;
  consignedQuantity: number;
}

export interface VariantLookupResponseDTO {
  product: ProductResponseDTO;
  variant?: ProductVariantResponseDTO | null;
}

export interface ProductItemResponseDTO {
  productId: string;
  variantId?: string;
  productName?: string;
  variantLabel?: string;
  variantAttributes?: Record<string, string>;
  quantity: number;
  priceAtSale?: number;
  serialNumbers?: string[];
  consignment?: boolean;
}

export interface SaleResponseDTO {
  id: string;
  clientName: string;
  operatorId?: string;
  operatorName?: string;
  products: ProductItemResponseDTO[];
  montantTotal: number;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InvoiceStatus = 'PAYE' | 'PARTIEL' | 'IMPAYE';
export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'CARTE';

export interface SaleCreateProductItemDTO {
  productId: string;
  variantId: string;
  quantity: number;
  priceAtSale: number;
  preferConsigned?: boolean;
  serialNumbers?: string[];
}

export interface SaleRequestDTO {
  clientId: string;
  products: SaleCreateProductItemDTO[];
  date: string;
  invoiceStatus: InvoiceStatus;
  initialPaidAmount?: number;
}

export interface InvoiceLineDTO {
  productId?: string;
  variantId?: string;
  productName?: string;
  variantLabel?: string;
  variantAttributes?: Record<string, string>;
  quantity: number;
  unitPrice: number;
  total: number;
  serialNumbers?: string[];
  consignment?: boolean;
}

export interface ProductUnitResponseDTO {
  id: string;
  productId: string;
  variantId: string;
  serialNumber: string;
  status: ProductUnitStatus;
  providerId?: string;
  origin?: MovementSource;
  purchaseDate?: string;
  soldDate?: string;
  saleId?: string;
  clientId?: string;
  warrantyEndsAt?: string;
}

export interface ProductUnitStatusUpdateRequestDTO {
  status: ProductUnitStatus;
  reason?: string;
}

export interface InvoiceCreateRequestDTO {
  saleId?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  date?: string;
  dueDate?: string;
  montant: number;
  lines?: InvoiceLineDTO[];
}

export interface InvoicePaymentRequestDTO {
  montant: number;
  moyen: PaymentMethod;
}

export interface PaymentResponseDTO {
  id: string;
  invoiceId?: string;
  saleId?: string;
  montant: number;
  date?: string;
  moyen?: PaymentMethod;
  tenantId?: string;
}

export interface InvoiceResponseDTO {
  id: string;
  invoiceNumber: string;
  saleId?: string;
  clientName: string;
  operatorId?: string;
  operatorName?: string;
  clientEmail?: string;
  clientPhone?: string;
  montant: number;
  amountPaid: number;
  balanceDue: number;
  statut: InvoiceStatus;
  date?: string;
  saleDate?: string;
  dueDate?: string;
  lastPaymentDate?: string;
  lines: InvoiceLineDTO[];
}

export type MovementType =
  | 'ENTREE'
  | 'SORTIE'
  | 'TRANSFERT'
  | 'ENVOI'
  | 'PRODUCTION'
  | 'MISE_AU_REBUT'
  | 'CONSIGNATION_ENTREE'
  | 'CONSIGNATION_SORTIE';

export type MovementSource =
  | 'VENTE'
  | 'RETOUR_CLIENT'
  | 'COMMANDE_FOURNISSEUR'
  | 'AJUSTEMENT'
  | 'TRANSFERT'
  | 'SAV'
  | 'PRODUCTION'
  | 'DESTRUCTION'
  | 'CONSIGNATION';

export interface StockMovementResponseDTO {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  type: MovementType;
  source?: MovementSource;
  date?: string;
  /** Fournisseur source (entrées + consignations entrantes). */
  providerId?: string;
  /** Prix d'achat unitaire saisi sur les entrees stock. */
  unitPurchasePrice?: number;
  serialNumbers?: string[];
  /** Client contrepartie (retours client). */
  clientId?: string;
  /** Vente associée (sortie sur vente, retour de vente). */
  saleId?: string;
  /** Référence libre (n° BL fournisseur, n° commande, n° retour). */
  reference?: string;
  /** @deprecated utiliser providerId/clientId/saleId. */
  sourceId?: string;
  destinationId?: string;
  operatorId?: string;
  reason?: string;
}

export interface StockMovementRequestDTO {
  productId: string;
  variantId: string;
  quantity: number;
  type: MovementType;
  source?: MovementSource;
  date?: string;
  /** Fournisseur source. Obligatoire pour CONSIGNATION_ENTREE. */
  providerId?: string;
  /** Prix d'achat unitaire saisi sur les entrees stock. */
  unitPurchasePrice?: number;
  serialNumbers?: string[];
  /** Client contrepartie. Obligatoire pour RETOUR_CLIENT (avec saleId comme alternative). */
  clientId?: string;
  /** Vente associée. */
  saleId?: string;
  /** Référence libre (n° BL fournisseur, n° commande, n° retour). */
  reference?: string;
  /** @deprecated utiliser providerId/clientId/saleId. */
  sourceId?: string;
  destinationId?: string;
  operatorId?: string;
  /** Obligatoire si source == AJUSTEMENT. */
  reason?: string;
}

export interface CommerceSettingsResponseDTO {
  id: string;
  nom: string;
  adresse?: string;
  devise: string;
  /**
   * URL relative vers le logo si téléversé, ex {@code /api/v1/commerce-settings/{id}/logo}.
   * Mis à jour automatiquement par le backend après chaque upload réussi.
   */
  logoUrl?: string;
  facturePDFActive?: boolean;
}

export interface CommerceSettingsRequestDTO {
  nom: string;
  adresse?: string;
  devise: string;
  facturePDFActive?: boolean;
}

// ── Reports / Dashboard agrégats ───────────────────────────────────────────────

export type SalesSummaryPeriod = 'today' | '7d' | '30d';

export interface SalesSummaryResponseDTO {
  count: number;
  total: number;
  paidTotal: number;
  unpaidTotal: number;
}

export interface InvoicesSummaryResponseDTO {
  paye: number;
  partiel: number;
  impaye: number;
  totalDue: number;
}

export interface SupplierDebtLineDTO {
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  consignedQuantity: number;
  providerPrice: number;
  lineDebt: number;
}

export interface SupplierDebtResponseDTO {
  providerId: string;
  providerName: string;
  totalConsignedUnits: number;
  totalDebt: number;
  lines: SupplierDebtLineDTO[];
}

// ── User self-service ─────────────────────────────────────────────────────────

export interface ChangePasswordRequestDTO {
  currentPassword: string;
  newPassword: string;
}

// ── Validation pré-formulaire des tokens ──────────────────────────────────────
// Codes possibles (champ reason, lorsque valid=false) :
//   MISSING / INVALID / EXPIRED — pour reset-password & verify-email
//   MISSING / INVALID / EXPIRED / ACCEPTED / DECLINED / REVOKED — pour invitation
export interface TokenValidationResponseDTO {
  valid: boolean;
  reason?: string;
}

export interface InvitationValidationResponseDTO {
  valid: boolean;
  reason?: string;
  /** Renseignés uniquement quand valid=true, pour pré-remplir l'écran d'acceptation. */
  email?: string;
  role?: string;
}

// ── Notifications in-app ──────────────────────────────────────────────────────

export type NotificationType =
  | 'INVOICE_UNPAID'
  | 'LOW_STOCK'
  | 'SALE_CREATED'
  | 'INVITATION_ACCEPTED'
  | 'ACCOUNT_STATUS_CHANGED'
  | 'GENERIC';

export interface NotificationResponseDTO {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  metadata?: Record<string, string>;
  read: boolean;
  readAt?: string;
  createdAt?: string;
}

export interface UnreadCountResponseDTO {
  unreadCount: number;
}

// ── Push tokens ───────────────────────────────────────────────────────────────

export type PushPlatform = 'IOS' | 'ANDROID' | 'WEB';

export interface RegisterPushTokenRequestDTO {
  token: string;
  platform: PushPlatform;
}

export interface SessionState {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  /** Identifiant interne de l'utilisateur, résolu via {@code GET /users/me}
   *  après le login. Peut être absent en attente du bootstrap profil. */
  userId?: string;
  name?: string;
  email: string;
  role: string;
  /** Statut administratif. Le login serveur refuse déjà les non-ACTIVE,
   *  mais le champ est conservé pour l'UI (ex. badge "compte actif"). */
  status?: UserStatus;
  tokenType: string;
}
