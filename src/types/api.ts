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

export interface UserResponseDTO {
  name?: string;
  email: string;
  role: string;
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
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';

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

export interface ProductResponseDTO {
  id: string;
  name: string;
  brand?: string;
  price?: number;
  categoryId?: string;
  categoryName?: string;
  trackingMode?: TrackingMode;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductRequestDTO {
  name: string;
  brand?: string;
  price: number;
  categoryId: string;
  trackingMode?: TrackingMode;
}

export interface ProductVariantResponseDTO {
  id: string;
  productId: string;
  name?: string;
  sku?: string;
  barcode?: string;
  attributes?: Record<string, string>;
  price?: number;
  stock: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariantRequestDTO {
  name?: string;
  sku?: string;
  barcode?: string;
  attributes?: Record<string, string>;
  price?: number;
  stock?: number;
}

export interface ProductItemResponseDTO {
  productId: string;
  variantId?: string;
  productName?: string;
  quantity: number;
  priceAtSale?: number;
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
  /** Optionnel : la variante par défaut du produit est utilisée si non fourni. */
  variantId?: string;
  quantity: number;
  priceAtSale: number;
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
  quantity: number;
  unitPrice: number;
  total: number;
  consignment?: boolean;
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
  variantId?: string;
  quantity: number;
  type: MovementType;
  source?: MovementSource;
  date?: string;
  sourceId?: string;
  destinationId?: string;
  operatorId?: string;
  reason?: string;
}

export interface StockMovementRequestDTO {
  productId: string;
  /** Optionnel : la variante par défaut du produit est utilisée si non fourni. */
  variantId?: string;
  quantity: number;
  type: MovementType;
  source?: MovementSource;
  date?: string;
  sourceId?: string;
  destinationId?: string;
  operatorId?: string;
  reason?: string;
}

export interface CommerceSettingsResponseDTO {
  id: string;
  nom: string;
  devise: string;
}

export interface CommerceSettingsRequestDTO {
  nom: string;
  devise: string;
  facturePDFActive?: boolean;
}

export interface SessionState {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  name?: string;
  email: string;
  role: string;
  tokenType: string;
}
