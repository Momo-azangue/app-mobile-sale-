const FALLBACK_API_BASE_URL = 'http://192.168.1.68:8080';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || FALLBACK_API_BASE_URL;
