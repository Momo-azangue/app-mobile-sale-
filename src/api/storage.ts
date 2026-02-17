import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SessionState } from '../types/api';

const SESSION_STORAGE_KEY = 'sales.mobile.session.v1';

export async function loadSession(): Promise<SessionState | null> {
  const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function persistSession(session: SessionState): Promise<void> {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}
