const FALLBACK_API_BASE_URL = 'http://10.147.156.79:8080';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || FALLBACK_API_BASE_URL;
