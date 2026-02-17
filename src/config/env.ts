const FALLBACK_API_BASE_URL = 'http://172.20.1.127:8080';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || FALLBACK_API_BASE_URL;
