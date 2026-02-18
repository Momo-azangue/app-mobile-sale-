import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { API_BASE_URL } from '../config/env';
import type { ErrorResponse } from '../types/api';

type HeaderGetter = () => string | null;
type RefreshHandler = () => Promise<string | null>;
type UnauthorizedHandler = () => void;

interface HttpAuthBindings {
  getAccessToken?: HeaderGetter;
  getTenantId?: HeaderGetter;
  refreshAccessToken?: RefreshHandler;
  onUnauthorized?: UnauthorizedHandler;
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _networkRetryCount?: number;
}

const authBindings: HttpAuthBindings = {};
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const MAX_NETWORK_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 350;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryNetworkRequest(
  originalRequest: RetriableRequestConfig | undefined,
  error: AxiosError<ErrorResponse>
): boolean {
  if (!originalRequest) {
    return false;
  }

  const method = (originalRequest.method ?? '').toLowerCase();
  if (!RETRYABLE_METHODS.has(method)) {
    return false;
  }

  const retryCount = originalRequest._networkRetryCount ?? 0;
  if (retryCount >= MAX_NETWORK_RETRIES) {
    return false;
  }

  const status = error.response?.status;
  if (!status) {
    return true;
  }

  return status >= 500 && status < 600;
}

export function configureHttpAuth(bindings: HttpAuthBindings): void {
  authBindings.getAccessToken = bindings.getAccessToken;
  authBindings.getTenantId = bindings.getTenantId;
  authBindings.refreshAccessToken = bindings.refreshAccessToken;
  authBindings.onUnauthorized = bindings.onUnauthorized;
}

export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = authBindings.getAccessToken?.();
  const tenantId = authBindings.getTenantId?.();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId;
  }

  return config;
});

publicApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponse>) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    if (!originalRequest || !shouldRetryNetworkRequest(originalRequest, error)) {
      return Promise.reject(error);
    }

    const retryCount = originalRequest._networkRetryCount ?? 0;
    originalRequest._networkRetryCount = retryCount + 1;
    await wait(RETRY_BASE_DELAY_MS * (2 ** retryCount));

    return publicApi(originalRequest);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponse>) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const path = originalRequest?.url ?? '';

    if (originalRequest && shouldRetryNetworkRequest(originalRequest, error)) {
      const retryCount = originalRequest._networkRetryCount ?? 0;
      originalRequest._networkRetryCount = retryCount + 1;
      await wait(RETRY_BASE_DELAY_MS * (2 ** retryCount));
      return api(originalRequest);
    }

    if (!originalRequest || originalRequest._retry || status !== 401) {
      return Promise.reject(error);
    }

    if (path.includes('/api/v1/auth/login') || path.includes('/api/v1/auth/refresh')) {
      return Promise.reject(error);
    }

    if (!authBindings.refreshAccessToken) {
      authBindings.onUnauthorized?.();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const nextToken = await authBindings.refreshAccessToken();
      if (!nextToken) {
        authBindings.onUnauthorized?.();
        return Promise.reject(error);
      }

      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      authBindings.onUnauthorized?.();
      return Promise.reject(refreshError);
    }
  }
);
