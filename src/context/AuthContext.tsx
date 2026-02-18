import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { clearSession, loadSession, persistSession } from '../api/storage';
import { login, refresh, registerAdminAndTenant } from '../api/services';
import { configureHttpAuth } from '../api/http';
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
    setSession(nextSession);
    sessionRef.current = nextSession;
    await persistSession(nextSession);
  }, []);

  const resetSession = useCallback(async () => {
    setSession(null);
    sessionRef.current = null;
    await clearSession();
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
        name: refreshed.name ?? currentSession.name,
        email: refreshed.email ?? currentSession.email,
        role: refreshed.role ?? currentSession.role,
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
      getTenantId: () => sessionRef.current?.tenantId ?? null,
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

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const toSessionState = (auth: AuthResponseDTO): SessionState => {
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

    setIsAuthenticating(true);
    try {
      const auth = await login(email, password);
      const nextSession = toSessionState(auth);
      await applySession(nextSession);
    } finally {
      setIsAuthenticating(false);
    }
  }, [applySession]);

  const registerAndLogin = useCallback(async (payload: RegisterRequestDTO) => {
    const toSessionState = (auth: AuthResponseDTO): SessionState => {
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

    setIsAuthenticating(true);
    try {
      await registerAdminAndTenant(payload);
      const auth = await login(payload.user.email, payload.user.password);
      const nextSession = toSessionState(auth);
      await applySession(nextSession);
    } finally {
      setIsAuthenticating(false);
    }
  }, [applySession]);

  const logout = useCallback(async () => {
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
