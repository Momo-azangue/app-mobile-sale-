import axios from 'axios';

import type { ErrorResponse } from '../types/api';

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    const backendMessage = error.response?.data?.message;
    if (backendMessage && backendMessage.trim().length > 0) {
      return backendMessage;
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
