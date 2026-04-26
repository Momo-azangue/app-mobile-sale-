import axios from 'axios';

import type { ErrorResponse } from '../types/api';

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    const data = error.response?.data;

    // Backend renvoie du Problem+JSON RFC 7807. Préférer `detail` (message
    // métier précis), retomber sur `title` (libellé du status), puis sur
    // les fallbacks Axios.
    if (data?.detail && data.detail.trim().length > 0) {
      return data.detail;
    }
    if (data?.title && data.title.trim().length > 0) {
      return data.title;
    }

    if (error.response?.status === 0) {
      return 'Network unavailable.';
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected error.';
}
