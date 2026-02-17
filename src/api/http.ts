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
}

const authBindings: HttpAuthBindings = {};

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

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponse>) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const path = originalRequest?.url ?? '';

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
