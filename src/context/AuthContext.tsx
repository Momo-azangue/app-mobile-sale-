import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { clearSession, loadSession, persistSession } from '../api/storage';
import {
  getCurrentUser,
  login,
  logout as logoutRequest,
  refresh,
  registerAdminAndTenant,
} from '../api/services';
import { configureHttpAuth } from '../api/http';
import { clearMemoryCache } from '../api/memoryCache';
import type { AuthResponseDTO, RegisterRequestDTO, SessionState } from '../types/api';

interface AuthContextValue {
  session: SessionState | null;
  isBooting: boolean;
  isAuthenticating: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerAndLogin: (payload: RegisterRequestDTO) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const sessionRef = useRef<SessionState | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const applySession = useCallback(async (nextSession: SessionState) => {
    const previousTenantId = sessionRef.current?.tenantId;
    if (previousTenantId && previousTenantId !== nextSession.tenantId) {
      clearMemoryCache();
    }
    setSession(nextSession);
    sessionRef.current = nextSession;
    await persistSession(nextSession);
  }, []);

  const resetSession = useCallback(async () => {
    clearMemoryCache();
    setSession(null);
    sessionRef.current = null;
    await clearSession();
  }, []);

  /**
   * Complète une session basique avec le profil utilisateur via {@code GET /users/me}.
   * Best-effort : si l'appel échoue (offline, timeout), la session est tout de même
   * appliquée avec {@code userId}/{@code status} undefined — l'app reste utilisable.
   */
  const enrichWithProfile = useCallback(async (base: SessionState): Promise<SessionState> => {
    // L'appel /users/me lit le token via l'intercepteur axios. On configure
    // donc temporairement le sessionRef pour que getAccessToken() trouve la
    // bonne valeur. La session officielle est posée *après* l'enrichissement.
    sessionRef.current = base;
    try {
      const me = await getCurrentUser();
      return {
        ...base,
        userId: me.id ?? base.userId,
        name: me.name ?? base.name,
        role: me.role ?? base.role,
        status: me.status ?? base.status,
      };
    } catch {
      // Tolérant : on continue avec la session basique.
      return base;
    }
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const currentSession = sessionRef.current;
    if (!currentSession?.refreshToken) {
      await resetSession();
      return null;
    }

    refreshPromiseRef.current = (async () => {
      const refreshed = await refresh(currentSession.refreshToken);

      const merged: SessionState = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? currentSession.refreshToken,
        tenantId: refreshed.tenantId ?? currentSession.tenantId,
        userId: currentSession.userId,
        name: refreshed.name ?? currentSession.name,
        email: refreshed.email ?? currentSession.email,
        role: refreshed.role ?? currentSession.role,
        status: currentSession.status,
        tokenType: refreshed.tokenType ?? currentSession.tokenType,
      };

      await applySession(merged);
      return merged.accessToken;
    })()
      .catch(async (error) => {
        await resetSession();
        throw error;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [applySession, resetSession]);

  useEffect(() => {
    configureHttpAuth({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      refreshAccessToken,
      onUnauthorized: () => {
        void resetSession();
      },
    });
  }, [refreshAccessToken, resetSession]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const loaded = await loadSession();
      if (mounted && loaded) {
        setSession(loaded);
        sessionRef.current = loaded;
      }
      if (mounted) {
        setIsBooting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const toBaseSession = (auth: AuthResponseDTO): SessionState => {
    if (!auth.refreshToken) {
      throw new Error('No refresh token returned by API.');
    }

    return {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      tenantId: auth.tenantId,
      name: auth.name,
      email: auth.email,
      role: auth.role,
      tokenType: auth.tokenType,
    };
  };

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true);
    try {
      const auth = await login(email, password);
      const baseSession = toBaseSession(auth);
      const enriched = await enrichWithProfile(baseSession);
      await applySession(enriched);
    } finally {
      setIsAuthenticating(false);
    }
  }, [applySession, enrichWithProfile]);

  const registerAndLogin = useCallback(async (payload: RegisterRequestDTO) => {
    setIsAuthenticating(true);
    try {
      await registerAdminAndTenant(payload);
      const auth = await login(payload.user.email, payload.user.password);
      const baseSession = toBaseSession(auth);
      const enriched = await enrichWithProfile(baseSession);
      await applySession(enriched);
    } finally {
      setIsAuthenticating(false);
    }
  }, [applySession, enrichWithProfile]);

  const logout = useCallback(async () => {
    const refreshToken = sessionRef.current?.refreshToken;
    // On appelle le backend pour révoquer le refresh token côté serveur, mais
    // on clear toujours la session locale même si l'appel échoue (offline,
    // token déjà invalide, etc.) pour éviter de coincer l'utilisateur.
    if (refreshToken) {
      try {
        await logoutRequest(refreshToken);
      } catch {
        // ignoré : on déconnecte localement quoi qu'il arrive
      }
    }
    await resetSession();
  }, [resetSession]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isBooting,
    isAuthenticating,
    loginWithPassword,
    registerAndLogin,
    logout,
  }), [session, isBooting, isAuthenticating, loginWithPassword, registerAndLogin, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
