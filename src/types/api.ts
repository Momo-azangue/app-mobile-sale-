export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}

export interface AuthResponseDTO {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn?: number;
  email: string;
  role: string;
  tenantId: string;
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

export interface InviteUserRequestDTO {
  email: string;
  role: InvitationRole;
}

export interface ProductResponseDTO {
  id: string;
  name: string;
  categoryName?: string;
}

export interface ProductItemResponseDTO {
  productId: string;
  quantity: number;
}

export interface SaleResponseDTO {
  id: string;
  clientName: string;
  products: ProductItemResponseDTO[];
  montantTotal: number;
}

export type InvoiceStatus = 'PAYE' | 'PARTIEL' | 'IMPAYE';

export interface SaleCreateProductItemDTO {
  productId: string;
  quantity: number;
  priceAtSale: number;
}

export interface SaleRequestDTO {
  clientId: string;
  products: SaleCreateProductItemDTO[];
  date: string;
  invoiceStatus: InvoiceStatus;
}

export interface InvoiceLineDTO {
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  consignment?: boolean;
}

export interface InvoiceResponseDTO {
  id: string;
  invoiceNumber: string;
  saleId?: string;
  clientName: string;
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
  email: string;
  role: string;
  tokenType: string;
}
