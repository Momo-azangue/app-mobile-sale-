import { api, publicApi } from './http';
import { cachedList } from './cache';
import type {
  AuthResponseDTO,
  CategoryRequestDTO,
  CategoryResponseDTO,
  ChangePlanRequestDTO,
  ClientRequestDTO,
  ClientResponseDTO,
  CommerceSettingsRequestDTO,
  CommerceSettingsResponseDTO,
  ForgotPasswordRequestDTO,
  InviteUserRequestDTO,
  InvitationResponseDTO,
  InvoiceCreateRequestDTO,
  InvoicePaymentRequestDTO,
  InvoiceResponseDTO,
  PagedResponse,
  ProviderRequestDTO,
  ProviderResponseDTO,
  ProductRequestDTO,
  ProductResponseDTO,
  ProductVariantRequestDTO,
  ProductVariantResponseDTO,
  RegisterRequestDTO,
  SaleRequestDTO,
  SaleResponseDTO,
  StockMovementRequestDTO,
  StockMovementResponseDTO,
  SubscriptionPlanDTO,
  TenantRequestDTO,
  TenantResponseDTO,
  VerifyEmailConfirmRequestDTO,
  VerifyEmailRequestDTO,
  UserResponseDTO,
  ResetPasswordRequestDTO,
} from '../types/api';

// Taille de page utilisée par les helpers non paginés (listInvoices, listSales,
// listProducts) pour préserver le comportement « tout charger ». Au-delà de
// ce seuil, basculer sur les variantes *Page() pour de la vraie pagination.
const DEFAULT_BULK_PAGE_SIZE = 200;

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
  return cachedList('clients', async () => {
    const { data } = await api.get<PagedResponse<ClientResponseDTO>>('/api/v1/clients', {
      params: { page: 0, size: DEFAULT_BULK_PAGE_SIZE },
    });
    return data.content;
  });
}

export async function listClientsPage(
  page: number,
  size: number
): Promise<PagedResponse<ClientResponseDTO>> {
  const { data } = await api.get<PagedResponse<ClientResponseDTO>>('/api/v1/clients', {
    params: { page, size },
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
  return cachedList('providers', async () => {
    const { data } = await api.get<ProviderResponseDTO[]>('/api/v1/providers');
    return data;
  });
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
  return cachedList('categories', async () => {
    const { data } = await api.get<CategoryResponseDTO[]>('/api/v1/categories');
    return data;
  });
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
  return cachedList('invitations', async () => {
    const { data } = await api.get<InvitationResponseDTO[]>('/api/v1/invitations');
    return data;
  });
}

export async function acceptInvitation(token: string, password: string): Promise<void> {
  await publicApi.post('/api/v1/invitations/accept', null, {
    params: { token, password },
  });
}

export async function listProducts(): Promise<ProductResponseDTO[]> {
  return cachedList('products', async () => {
    const { data } = await api.get<PagedResponse<ProductResponseDTO>>('/api/v1/products', {
      params: { page: 0, size: DEFAULT_BULK_PAGE_SIZE },
    });
    return data.content;
  });
}

export async function listProductsPage(
  page: number,
  size: number
): Promise<PagedResponse<ProductResponseDTO>> {
  const { data } = await api.get<PagedResponse<ProductResponseDTO>>('/api/v1/products', {
    params: { page, size },
  });
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

export async function listStockMovements(): Promise<StockMovementResponseDTO[]> {
  return cachedList('stock-movements', async () => {
    const { data } = await api.get<StockMovementResponseDTO[]>('/api/v1/stock-movements');
    return data;
  });
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

export async function listSales(): Promise<SaleResponseDTO[]> {
  return cachedList('sales', async () => {
    const { data } = await api.get<PagedResponse<SaleResponseDTO>>('/api/v1/sales', {
      params: { page: 0, size: DEFAULT_BULK_PAGE_SIZE },
    });
    return data.content;
  });
}

export async function listSalesPage(
  page: number,
  size: number
): Promise<PagedResponse<SaleResponseDTO>> {
  const { data } = await api.get<PagedResponse<SaleResponseDTO>>('/api/v1/sales', {
    params: { page, size },
  });
  return data;
}

export async function createSale(payload: SaleRequestDTO): Promise<SaleResponseDTO> {
  const { data } = await api.post<SaleResponseDTO>('/api/v1/sales', payload);
  return data;
}

export async function listInvoices(): Promise<InvoiceResponseDTO[]> {
  return cachedList('invoices', async () => {
    const { data } = await api.get<PagedResponse<InvoiceResponseDTO>>('/api/v1/invoices', {
      params: { page: 0, size: DEFAULT_BULK_PAGE_SIZE },
    });
    return data.content;
  });
}

export async function listInvoicesPage(
  page: number,
  size: number
): Promise<PagedResponse<InvoiceResponseDTO>> {
  const { data } = await api.get<PagedResponse<InvoiceResponseDTO>>('/api/v1/invoices', {
    params: { page, size },
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
  const { data } = await api.get<UserResponseDTO[]>('/api/v1/tenants/me/users');
  return data;
}

export async function changeMyTenantPlan(planId: string): Promise<TenantResponseDTO> {
  const payload: ChangePlanRequestDTO = { planId };
  const { data } = await api.post<TenantResponseDTO>('/api/v1/tenants/me/plan', payload);
  return data;
}
