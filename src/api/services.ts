import { api, publicApi } from './http';
import type {
  AuthResponseDTO,
  ClientRequestDTO,
  ClientResponseDTO,
  CommerceSettingsRequestDTO,
  CommerceSettingsResponseDTO,
  InvoiceResponseDTO,
  ProductResponseDTO,
  RegisterRequestDTO,
  SaleRequestDTO,
  SaleResponseDTO,
  StockMovementResponseDTO,
  SubscriptionPlanDTO,
  UserResponseDTO,
} from '../types/api';

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

export async function registerAdminAndTenant(payload: RegisterRequestDTO): Promise<UserResponseDTO> {
  const { data } = await publicApi.post<UserResponseDTO>('/api/v1/users/register', payload);
  return data;
}

export async function listPlans(): Promise<SubscriptionPlanDTO[]> {
  const { data } = await publicApi.get<SubscriptionPlanDTO[]>('/api/v1/plans');
  return data;
}

export async function listClients(): Promise<ClientResponseDTO[]> {
  const { data } = await api.get<ClientResponseDTO[]>('/api/v1/clients');
  return data;
}

export async function createClient(payload: ClientRequestDTO): Promise<ClientResponseDTO> {
  const { data } = await api.post<ClientResponseDTO>('/api/v1/clients', payload);
  return data;
}

export async function deleteClient(clientId: string): Promise<void> {
  await api.delete(`/api/v1/clients/${clientId}`);
}

export async function listProducts(): Promise<ProductResponseDTO[]> {
  const { data } = await api.get<ProductResponseDTO[]>('/api/v1/products');
  return data;
}

export async function listStockMovements(): Promise<StockMovementResponseDTO[]> {
  const { data } = await api.get<StockMovementResponseDTO[]>('/api/v1/stock-movements');
  return data;
}

export async function listSales(): Promise<SaleResponseDTO[]> {
  const { data } = await api.get<SaleResponseDTO[]>('/api/v1/sales');
  return data;
}

export async function createSale(payload: SaleRequestDTO): Promise<SaleResponseDTO> {
  const { data } = await api.post<SaleResponseDTO>('/api/v1/sales', payload);
  return data;
}

export async function listInvoices(): Promise<InvoiceResponseDTO[]> {
  const { data } = await api.get<InvoiceResponseDTO[]>('/api/v1/invoices');
  return data;
}

export async function listCommerceSettings(): Promise<CommerceSettingsResponseDTO[]> {
  const { data } = await api.get<CommerceSettingsResponseDTO[]>('/api/v1/commerce-settings');
  return data;
}

export async function createCommerceSettings(
  payload: CommerceSettingsRequestDTO
): Promise<CommerceSettingsResponseDTO> {
  const { data } = await api.post<CommerceSettingsResponseDTO>('/api/v1/commerce-settings', payload);
  return data;
}
