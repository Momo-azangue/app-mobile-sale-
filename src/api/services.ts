import { api, publicApi } from './http';
import { cachedList } from './cache';
import type {
  AuthResponseDTO,
  CategoryRequestDTO,
  CategoryResponseDTO,
  ChangePasswordRequestDTO,
  ChangePlanRequestDTO,
  ClientRequestDTO,
  ClientResponseDTO,
  CommerceSettingsRequestDTO,
  CommerceSettingsResponseDTO,
  ForgotPasswordRequestDTO,
  InvitationResponseDTO,
  InvitationStatus,
  InvitationValidationResponseDTO,
  InviteUserRequestDTO,
  InvoiceCreateRequestDTO,
  InvoicePaymentRequestDTO,
  InvoiceResponseDTO,
  InvoiceStatus,
  InvoicesSummaryResponseDTO,
  NotificationResponseDTO,
  PagedResponse,
  PaymentMethod,
  PaymentResponseDTO,
  ProductRequestDTO,
  ProductResponseDTO,
  ProductUnitResponseDTO,
  ProductUnitStatus,
  ProductUnitStatusUpdateRequestDTO,
  ProductVariantRequestDTO,
  ProductVariantResponseDTO,
  ProviderRequestDTO,
  ProviderResponseDTO,
  RegisterPushTokenRequestDTO,
  RegisterRequestDTO,
  ResetPasswordRequestDTO,
  SaleRequestDTO,
  SaleResponseDTO,
  SalesSummaryPeriod,
  SalesSummaryResponseDTO,
  StockMovementRequestDTO,
  StockMovementResponseDTO,
  SubscriptionPlanDTO,
  TenantRequestDTO,
  TenantResponseDTO,
  TokenValidationResponseDTO,
  TrackingMode,
  UnreadCountResponseDTO,
  UserResponseDTO,
  UserStatus,
  UserStatusUpdateRequestDTO,
  VerifyEmailConfirmRequestDTO,
  VerifyEmailRequestDTO,
} from '../types/api';

// Taille max d'une page côté serveur — borne stricte appliquée par
// {@code @Max(100)} sur les controllers Spring. Toute requête à une taille
// supérieure renvoie 400. On a donc deux stratégies pour les helpers
// "tout charger" :
//   - une page suffit pour les petits tenants (< 100 lignes)
//   - sinon {@link fetchAllPages} itère jusqu'à épuisement de totalElements.
const DEFAULT_BULK_PAGE_SIZE = 100;
/** Garde-fou : on cesse de paginer après 50 pages (= 5000 items) pour
 *  éviter de boucler sur un compteur incohérent. */
const MAX_BULK_PAGES = 50;

/**
 * Itère sur les pages d'un endpoint paginé jusqu'à récupérer tous les
 * documents (ou atteindre la garde-fou {@link MAX_BULK_PAGES}). Permet aux
 * écrans bulk (Stocks, Factures sans filtre, etc.) de continuer à offrir une
 * vue complète malgré la borne stricte du backend sur {@code size}.
 */
async function fetchAllPages<T>(
  loader: (page: number, size: number) => Promise<PagedResponse<T>>,
  pageSize: number = DEFAULT_BULK_PAGE_SIZE,
): Promise<T[]> {
  const accumulator: T[] = [];
  for (let page = 0; page < MAX_BULK_PAGES; page += 1) {
    const result = await loader(page, pageSize);
    accumulator.push(...result.content);
    const reachedEnd =
      result.content.length < pageSize
      || accumulator.length >= result.totalElements;
    if (reachedEnd) {
      break;
    }
  }
  return accumulator;
}

interface ListStockMovementsParams {
  page?: number;
  size?: number;
  from?: string;
  to?: string;
  type?: StockMovementResponseDTO['type'];
  source?: StockMovementResponseDTO['source'];
  productId?: string;
  variantId?: string;
  providerId?: string;
  clientId?: string;
  saleId?: string;
}

interface ListPaymentsParams {
  page?: number;
  size?: number;
  from?: string;
  to?: string;
  invoiceId?: string;
  saleId?: string;
  method?: PaymentMethod;
  moyen?: PaymentMethod;
}

export interface ListSalesParams {
  page?: number;
  size?: number;
  from?: string;
  to?: string;
  clientId?: string;
  /** Filtre serveur sur le statut paiement (alias possible : statut). */
  paymentStatus?: InvoiceStatus;
  q?: string;
}

export interface ListInvoicesParams {
  page?: number;
  size?: number;
  from?: string;
  to?: string;
  clientId?: string;
  saleId?: string;
  status?: InvoiceStatus;
  q?: string;
}

export interface ListProductsParams {
  page?: number;
  size?: number;
  q?: string;
  categoryId?: string;
  providerId?: string;
  trackingMode?: TrackingMode;
}

export interface ListClientsParams {
  page?: number;
  size?: number;
  q?: string;
}

export interface ListCategoriesParams {
  page?: number;
  size?: number;
  q?: string;
}

export interface ListProvidersParams {
  page?: number;
  size?: number;
  q?: string;
}

export interface ListInvitationsParams {
  page?: number;
  size?: number;
  status?: InvitationStatus;
}

export interface ListMyTenantUsersParams {
  page?: number;
  size?: number;
  status?: UserStatus;
  q?: string;
}

export interface ListNotificationsParams {
  page?: number;
  size?: number;
  unreadOnly?: boolean;
}

/**
 * Enlève les valeurs nullish d'un objet de query params pour ne pas envoyer
 * {@code ?status=undefined} ou {@code ?q=}. axios sérialise sinon ces clés vides.
 */
function compactParams<T extends Record<string, unknown>>(params: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    out[key] = value;
  }
  return out;
}

export async function login(email: string, password: string): Promise<AuthResponseDTO> {
  const { data } = await publicApi.post<AuthResponseDTO>('/api/v1/auth/login', {
    email,
    password,
  });
  return data;
}

export async function refresh(refreshToken: string): Promise<AuthResponseDTO> {
  const { data } = await publicApi.post<AuthResponseDTO>('/api/v1/auth/refresh', {
    refreshToken,
  });
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await publicApi.post('/api/v1/auth/logout', { refreshToken });
}

export async function requestPasswordReset(payload: ForgotPasswordRequestDTO): Promise<void> {
  await publicApi.post('/api/v1/auth/forgot-password', payload);
}

export async function resetPassword(payload: ResetPasswordRequestDTO): Promise<void> {
  await publicApi.post('/api/v1/auth/reset-password', payload);
}

export async function requestEmailVerification(payload: VerifyEmailRequestDTO): Promise<void> {
  await publicApi.post('/api/v1/auth/verify-email/request', payload);
}

export async function confirmEmailVerification(payload: VerifyEmailConfirmRequestDTO): Promise<void> {
  await publicApi.post('/api/v1/auth/verify-email/confirm', payload);
}

export async function registerAdminAndTenant(payload: RegisterRequestDTO): Promise<UserResponseDTO> {
  const { data } = await publicApi.post<UserResponseDTO>('/api/v1/users/register', payload);
  return data;
}

export async function listPlans(): Promise<SubscriptionPlanDTO[]> {
  return cachedList('plans', async () => {
    const { data } = await publicApi.get<SubscriptionPlanDTO[]>('/api/v1/plans');
    return data;
  });
}

export async function listClients(): Promise<ClientResponseDTO[]> {
  return cachedList('clients', () =>
    fetchAllPages((page, size) => listClientsPage({ page, size })),
  );
}

export async function listClientsPage(
  params: ListClientsParams = {}
): Promise<PagedResponse<ClientResponseDTO>> {
  const { page = 0, size = 20, q } = params;
  const { data } = await api.get<PagedResponse<ClientResponseDTO>>('/api/v1/clients', {
    params: compactParams({ page, size, q }),
  });
  return data;
}

export async function createClient(payload: ClientRequestDTO): Promise<ClientResponseDTO> {
  const { data } = await api.post<ClientResponseDTO>('/api/v1/clients', payload);
  return data;
}

export async function updateClient(
  clientId: string,
  payload: ClientRequestDTO
): Promise<ClientResponseDTO> {
  const { data } = await api.put<ClientResponseDTO>(`/api/v1/clients/${clientId}`, payload);
  return data;
}

export async function deleteClient(clientId: string): Promise<void> {
  await api.delete(`/api/v1/clients/${clientId}`);
}

export async function listProviders(): Promise<ProviderResponseDTO[]> {
  // Le backend renvoie maintenant PagedResponse — on dépagine tout le tenant
  // (les fournisseurs restent peu nombreux, donc 1-2 pages suffisent toujours).
  return cachedList('providers', () =>
    fetchAllPages((page, size) => listProvidersPage({ page, size })),
  );
}

export async function createProvider(payload: ProviderRequestDTO): Promise<void> {
  await api.post('/api/v1/providers', payload);
}

export async function updateProvider(providerId: string, payload: ProviderRequestDTO): Promise<ProviderResponseDTO> {
  const { data } = await api.put<ProviderResponseDTO>(`/api/v1/providers/${providerId}`, payload);
  return data;
}

export async function deleteProvider(providerId: string): Promise<void> {
  await api.delete(`/api/v1/providers/${providerId}`);
}

export async function listCategories(): Promise<CategoryResponseDTO[]> {
  // Le backend renvoie maintenant PagedResponse — dépagination complète.
  return cachedList('categories', () =>
    fetchAllPages((page, size) => listCategoriesPage({ page, size })),
  );
}

export async function createCategory(payload: CategoryRequestDTO): Promise<CategoryResponseDTO> {
  const { data } = await api.post<CategoryResponseDTO>('/api/v1/categories', payload);
  return data;
}

export async function updateCategory(
  categoryId: string,
  payload: CategoryRequestDTO
): Promise<CategoryResponseDTO> {
  const { data } = await api.put<CategoryResponseDTO>(`/api/v1/categories/${categoryId}`, payload);
  return data;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await api.delete(`/api/v1/categories/${categoryId}`);
}

export async function inviteUserToTenant(
  tenantId: string,
  payload: InviteUserRequestDTO
): Promise<void> {
  await api.post('/api/v1/invitations/invite', payload, {
    params: { tenantId },
  });
}

export async function listInvitations(): Promise<InvitationResponseDTO[]> {
  // Le backend renvoie maintenant PagedResponse — dépagination complète.
  return cachedList('invitations', () =>
    fetchAllPages((page, size) => listInvitationsPage({ page, size })),
  );
}

export async function acceptInvitation(token: string, password: string): Promise<void> {
  await publicApi.post('/api/v1/invitations/accept', null, {
    params: { token, password },
  });
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await api.patch(`/api/v1/invitations/${invitationId}/revoke`);
}

export async function listProducts(): Promise<ProductResponseDTO[]> {
  return cachedList('products', () =>
    fetchAllPages((page, size) => listProductsPage({ page, size })),
  );
}

export async function listProductsPage(
  params: ListProductsParams = {}
): Promise<PagedResponse<ProductResponseDTO>> {
  const { page = 0, size = 20, q, categoryId, providerId, trackingMode } = params;
  const { data } = await api.get<PagedResponse<ProductResponseDTO>>('/api/v1/products', {
    params: compactParams({ page, size, q, categoryId, providerId, trackingMode }),
  });
  return data;
}

export async function getProduct(productId: string): Promise<ProductResponseDTO> {
  const { data } = await api.get<ProductResponseDTO>(`/api/v1/products/${productId}`);
  return data;
}

export async function listLowStockProducts(threshold?: number): Promise<ProductResponseDTO[]> {
  const { data } = await api.get<ProductResponseDTO[]>('/api/v1/products/low-stock', {
    params: compactParams({ threshold }),
  });
  return data;
}

export async function getProductByBarcode(code: string): Promise<ProductResponseDTO> {
  const { data } = await api.get<ProductResponseDTO>(
    `/api/v1/products/by-barcode/${encodeURIComponent(code)}`
  );
  return data;
}

// ── Product Variants (nested under /products/{productId}/variants) ────────────

export async function listProductVariants(
  productId: string
): Promise<ProductVariantResponseDTO[]> {
  const { data } = await api.get<ProductVariantResponseDTO[]>(
    `/api/v1/products/${productId}/variants`
  );
  return data;
}

export async function getProductVariant(
  productId: string,
  variantId: string
): Promise<ProductVariantResponseDTO> {
  const { data } = await api.get<ProductVariantResponseDTO>(
    `/api/v1/products/${productId}/variants/${variantId}`
  );
  return data;
}

export async function createProductVariant(
  productId: string,
  payload: ProductVariantRequestDTO
): Promise<ProductVariantResponseDTO> {
  const { data } = await api.post<ProductVariantResponseDTO>(
    `/api/v1/products/${productId}/variants`,
    payload
  );
  return data;
}

export async function updateProductVariant(
  productId: string,
  variantId: string,
  payload: ProductVariantRequestDTO
): Promise<ProductVariantResponseDTO> {
  const { data } = await api.put<ProductVariantResponseDTO>(
    `/api/v1/products/${productId}/variants/${variantId}`,
    payload
  );
  return data;
}

export async function deleteProductVariant(
  productId: string,
  variantId: string
): Promise<void> {
  await api.delete(`/api/v1/products/${productId}/variants/${variantId}`);
}

export async function createProduct(payload: ProductRequestDTO): Promise<ProductResponseDTO> {
  const { data } = await api.post<ProductResponseDTO>('/api/v1/products', payload);
  return data;
}

export async function updateProduct(
  productId: string,
  payload: ProductRequestDTO
): Promise<ProductResponseDTO> {
  const { data } = await api.put<ProductResponseDTO>(`/api/v1/products/${productId}`, payload);
  return data;
}

export async function deleteProduct(productId: string): Promise<void> {
  await api.delete(`/api/v1/products/${productId}`);
}

export async function listProductUnits(params: {
  productId: string;
  variantId?: string;
  status?: ProductUnitStatus;
}): Promise<ProductUnitResponseDTO[]> {
  const { data } = await api.get<ProductUnitResponseDTO[]>('/api/v1/product-units', {
    params,
  });
  return data;
}

export async function listAvailableProductUnits(
  productId: string,
  variantId?: string
): Promise<ProductUnitResponseDTO[]> {
  const { data } = await api.get<ProductUnitResponseDTO[]>('/api/v1/product-units/available', {
    params: { productId, variantId },
  });
  return data;
}

export async function getProductUnitBySerialNumber(
  serialNumber: string
): Promise<ProductUnitResponseDTO> {
  const { data } = await api.get<ProductUnitResponseDTO>(
    `/api/v1/product-units/serial/${encodeURIComponent(serialNumber)}`
  );
  return data;
}

export async function updateProductUnitStatus(
  unitId: string,
  payload: ProductUnitStatusUpdateRequestDTO
): Promise<ProductUnitResponseDTO> {
  const { data } = await api.patch<ProductUnitResponseDTO>(
    `/api/v1/product-units/${unitId}/status`,
    payload
  );
  return data;
}

export async function listStockMovements(): Promise<StockMovementResponseDTO[]> {
  return cachedList('stock-movements', () =>
    fetchAllPages((page, size) => listStockMovementsPage({ page, size })),
  );
}

export async function listStockMovementsPage(
  params: ListStockMovementsParams = {}
): Promise<PagedResponse<StockMovementResponseDTO>> {
  const { page = 0, size = 20, ...filters } = params;
  const { data } = await api.get<PagedResponse<StockMovementResponseDTO>>('/api/v1/stock-movements', {
    params: { page, size, ...filters },
  });
  return data;
}

export async function listStockMovementsByProduct(
  productId: string
): Promise<StockMovementResponseDTO[]> {
  const { data } = await api.get<StockMovementResponseDTO[]>(
    `/api/v1/stock-movements/product/${productId}`
  );
  return data;
}

export async function createStockMovement(
  payload: StockMovementRequestDTO
): Promise<StockMovementResponseDTO> {
  const { data } = await api.post<StockMovementResponseDTO>('/api/v1/stock-movements', payload);
  return data;
}

export async function listPayments(): Promise<PaymentResponseDTO[]> {
  return cachedList('payments', () =>
    fetchAllPages((page, size) => listPaymentsPage({ page, size })),
  );
}

export async function listPaymentsPage(
  params: ListPaymentsParams = {}
): Promise<PagedResponse<PaymentResponseDTO>> {
  const { page = 0, size = 20, ...filters } = params;
  const { data } = await api.get<PagedResponse<PaymentResponseDTO>>('/api/v1/payments', {
    params: { page, size, ...filters },
  });
  return data;
}

export async function listSales(): Promise<SaleResponseDTO[]> {
  return cachedList('sales', () =>
    fetchAllPages((page, size) => listSalesPage({ page, size })),
  );
}

export async function listSalesPage(
  params: ListSalesParams = {}
): Promise<PagedResponse<SaleResponseDTO>> {
  const { page = 0, size = 20, from, to, clientId, paymentStatus, q } = params;
  const { data } = await api.get<PagedResponse<SaleResponseDTO>>('/api/v1/sales', {
    params: compactParams({ page, size, from, to, clientId, paymentStatus, q }),
  });
  return data;
}

export async function createSale(payload: SaleRequestDTO): Promise<SaleResponseDTO> {
  const { data } = await api.post<SaleResponseDTO>('/api/v1/sales', payload);
  return data;
}

export async function listSaleInvoices(saleId: string): Promise<InvoiceResponseDTO[]> {
  const { data } = await api.get<InvoiceResponseDTO[]>(`/api/v1/sales/${saleId}/invoices`);
  return data;
}

export async function listInvoices(): Promise<InvoiceResponseDTO[]> {
  return cachedList('invoices', () =>
    fetchAllPages((page, size) => listInvoicesPage({ page, size })),
  );
}

export async function listInvoicesPage(
  params: ListInvoicesParams = {}
): Promise<PagedResponse<InvoiceResponseDTO>> {
  const { page = 0, size = 20, from, to, clientId, saleId, status, q } = params;
  const { data } = await api.get<PagedResponse<InvoiceResponseDTO>>('/api/v1/invoices', {
    params: compactParams({ page, size, from, to, clientId, saleId, status, q }),
  });
  return data;
}

export async function createInvoice(payload: InvoiceCreateRequestDTO): Promise<InvoiceResponseDTO> {
  const { data } = await api.post<InvoiceResponseDTO>('/api/v1/invoices', payload);
  return data;
}

export async function createInvoiceFromSale(saleId: string): Promise<InvoiceResponseDTO> {
  const { data } = await api.post<InvoiceResponseDTO>(`/api/v1/invoices/from-sale/${saleId}`);
  return data;
}

export async function recordInvoicePayment(
  invoiceId: string,
  payload: InvoicePaymentRequestDTO
): Promise<InvoiceResponseDTO> {
  const { data } = await api.post<InvoiceResponseDTO>(`/api/v1/invoices/${invoiceId}/payments`, payload);
  return data;
}

export async function listInvoicePayments(invoiceId: string): Promise<PaymentResponseDTO[]> {
  const { data } = await api.get<PaymentResponseDTO[]>(`/api/v1/invoices/${invoiceId}/payments`);
  return data;
}

export async function downloadInvoicePdf(invoiceId: string): Promise<ArrayBuffer> {
  const { data } = await api.get<ArrayBuffer>(`/api/v1/invoices/${invoiceId}/pdf`, {
    responseType: 'arraybuffer',
    headers: {
      Accept: 'application/pdf',
    },
  });
  return data;
}

export async function previewInvoicePdf(saleId: string): Promise<ArrayBuffer> {
  const { data } = await api.get<ArrayBuffer>(`/api/v1/invoices/preview/${saleId}`, {
    responseType: 'arraybuffer',
    headers: {
      Accept: 'application/pdf',
    },
  });
  return data;
}

export async function listCommerceSettings(): Promise<CommerceSettingsResponseDTO[]> {
  return cachedList('commerce-settings', async () => {
    const { data } = await api.get<CommerceSettingsResponseDTO[]>('/api/v1/commerce-settings');
    return data;
  });
}

export async function createCommerceSettings(
  payload: CommerceSettingsRequestDTO
): Promise<CommerceSettingsResponseDTO> {
  const { data } = await api.post<CommerceSettingsResponseDTO>('/api/v1/commerce-settings', payload);
  return data;
}

export async function updateCommerceSettings(
  settingsId: string,
  payload: CommerceSettingsRequestDTO
): Promise<CommerceSettingsResponseDTO> {
  const { data } = await api.put<CommerceSettingsResponseDTO>(
    `/api/v1/commerce-settings/${settingsId}`,
    payload
  );
  return data;
}

// ── Tenant self-service (current tenant from JWT) ─────────────────────────────

export async function getMyTenant(): Promise<TenantResponseDTO> {
  const { data } = await api.get<TenantResponseDTO>('/api/v1/tenants/me');
  return data;
}

export async function updateMyTenant(payload: TenantRequestDTO): Promise<TenantResponseDTO> {
  const { data } = await api.put<TenantResponseDTO>('/api/v1/tenants/me', payload);
  return data;
}

export async function listMyTenantUsers(): Promise<UserResponseDTO[]> {
  // Le backend renvoie PagedResponse — dépagination complète pour rester
  // compatible avec les écrans qui consomment un Array (Invitations, etc.).
  return fetchAllPages((page, size) => listMyTenantUsersPage({ page, size }));
}

export async function changeMyTenantPlan(planId: string): Promise<TenantResponseDTO> {
  const payload: ChangePlanRequestDTO = { planId };
  const { data } = await api.post<TenantResponseDTO>('/api/v1/tenants/me/plan', payload);
  return data;
}

export async function updateUserStatus(
  userId: string,
  payload: UserStatusUpdateRequestDTO
): Promise<UserResponseDTO> {
  const { data } = await api.patch<UserResponseDTO>(`/api/v1/users/${userId}/status`, payload);
  return data;
}

// ── User self-service (current user) ──────────────────────────────────────────

export async function getCurrentUser(): Promise<UserResponseDTO> {
  const { data } = await api.get<UserResponseDTO>('/api/v1/users/me');
  return data;
}

export async function changeMyPassword(payload: ChangePasswordRequestDTO): Promise<void> {
  await api.post('/api/v1/users/me/password', payload);
}

// ── Reports / Dashboard agrégats ──────────────────────────────────────────────

export async function getSalesSummary(
  period: SalesSummaryPeriod = 'today'
): Promise<SalesSummaryResponseDTO> {
  const { data } = await api.get<SalesSummaryResponseDTO>('/api/v1/reports/sales-summary', {
    params: { period },
  });
  return data;
}

export async function getInvoicesSummary(): Promise<InvoicesSummaryResponseDTO> {
  const { data } = await api.get<InvoicesSummaryResponseDTO>('/api/v1/reports/invoices-summary');
  return data;
}

// ── Validation pré-formulaire des tokens (deep links) ─────────────────────────

export async function validateResetPasswordToken(token: string): Promise<TokenValidationResponseDTO> {
  const { data } = await publicApi.get<TokenValidationResponseDTO>(
    '/api/v1/auth/reset-password/validate',
    { params: { token } }
  );
  return data;
}

export async function validateEmailVerificationToken(token: string): Promise<TokenValidationResponseDTO> {
  const { data } = await publicApi.get<TokenValidationResponseDTO>(
    '/api/v1/auth/verify-email/validate',
    { params: { token } }
  );
  return data;
}

export async function validateInvitationToken(token: string): Promise<InvitationValidationResponseDTO> {
  const { data } = await publicApi.get<InvitationValidationResponseDTO>(
    '/api/v1/invitations/validate',
    { params: { token } }
  );
  return data;
}

// ── Invitations : resend + version paginée ─────────────────────────────────────

export async function resendInvitation(invitationId: string): Promise<void> {
  await api.post(`/api/v1/invitations/${invitationId}/resend`);
}

export async function listInvitationsPage(
  params: ListInvitationsParams = {}
): Promise<PagedResponse<InvitationResponseDTO>> {
  const { page = 0, size = 20, status } = params;
  const { data } = await api.get<PagedResponse<InvitationResponseDTO>>('/api/v1/invitations', {
    params: compactParams({ page, size, status }),
  });
  return data;
}

// ── Tenant users / categories / providers : pagination + filtres ──────────────

export async function listMyTenantUsersPage(
  params: ListMyTenantUsersParams = {}
): Promise<PagedResponse<UserResponseDTO>> {
  const { page = 0, size = 20, status, q } = params;
  const { data } = await api.get<PagedResponse<UserResponseDTO>>('/api/v1/tenants/me/users', {
    params: compactParams({ page, size, status, q }),
  });
  return data;
}

export async function listCategoriesPage(
  params: ListCategoriesParams = {}
): Promise<PagedResponse<CategoryResponseDTO>> {
  const { page = 0, size = 20, q } = params;
  const { data } = await api.get<PagedResponse<CategoryResponseDTO>>('/api/v1/categories', {
    params: compactParams({ page, size, q }),
  });
  return data;
}

export async function listProvidersPage(
  params: ListProvidersParams = {}
): Promise<PagedResponse<ProviderResponseDTO>> {
  const { page = 0, size = 20, q } = params;
  const { data } = await api.get<PagedResponse<ProviderResponseDTO>>('/api/v1/providers', {
    params: compactParams({ page, size, q }),
  });
  return data;
}

// ── Notifications in-app ──────────────────────────────────────────────────────

export async function listNotifications(
  params: ListNotificationsParams = {}
): Promise<PagedResponse<NotificationResponseDTO>> {
  const { page = 0, size = 20, unreadOnly = false } = params;
  const { data } = await api.get<PagedResponse<NotificationResponseDTO>>('/api/v1/notifications', {
    params: compactParams({ page, size, unreadOnly }),
  });
  return data;
}

export async function getUnreadNotificationsCount(): Promise<UnreadCountResponseDTO> {
  const { data } = await api.get<UnreadCountResponseDTO>('/api/v1/notifications/unread-count');
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<NotificationResponseDTO> {
  const { data } = await api.patch<NotificationResponseDTO>(
    `/api/v1/notifications/${notificationId}/read`
  );
  return data;
}

export async function markAllNotificationsRead(): Promise<UnreadCountResponseDTO> {
  const { data } = await api.post<UnreadCountResponseDTO>('/api/v1/notifications/read-all');
  return data;
}

// ── Push tokens (Expo) ────────────────────────────────────────────────────────

export async function registerPushToken(payload: RegisterPushTokenRequestDTO): Promise<void> {
  await api.post('/api/v1/users/me/push-tokens', payload);
}

export async function unregisterPushToken(token: string): Promise<void> {
  await api.delete(`/api/v1/users/me/push-tokens/${encodeURIComponent(token)}`);
}

// ── Commerce logo (multipart upload + serve + delete) ─────────────────────────

/**
 * Téléverse le logo du commerce. Le fichier doit être un PNG/JPEG/WebP de 1 MB max.
 *
 * @param settingsId ID du commerce-settings
 * @param file       descripteur de fichier React Native ({@code uri}, {@code name}, {@code type})
 *                   ou {@code Blob} en web
 */
export async function uploadCommerceLogo(
  settingsId: string,
  file: { uri: string; name: string; type: string } | Blob
): Promise<CommerceSettingsResponseDTO> {
  const formData = new FormData();
  // En React Native, FormData accepte { uri, name, type } cast en any. En web, c'est un Blob.
  formData.append('file', file as unknown as Blob);
  const { data } = await api.post<CommerceSettingsResponseDTO>(
    `/api/v1/commerce-settings/${settingsId}/logo`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data;
}

export async function deleteCommerceLogo(
  settingsId: string
): Promise<CommerceSettingsResponseDTO> {
  const { data } = await api.delete<CommerceSettingsResponseDTO>(
    `/api/v1/commerce-settings/${settingsId}/logo`
  );
  return data;
}
