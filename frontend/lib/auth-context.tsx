'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import {
  clearSession,
  getServerSessionSnapshot,
  getSessionSnapshot,
  saveSession,
  Session,
  subscribeToSession,
} from './session';

interface AuthContextValue {
  session: Session | null;
  login: (username: string, password: string) => Promise<void>;
  register: (body: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const router = useRouter();

  const login = useCallback(
    async (username: string, password: string) => {
      saveSession(await api.auth.login({ username, password }));
      router.push('/feed');
    },
    [router],
  );

  const register = useCallback(
    async (body: {
      username: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      saveSession(await api.auth.register(body));
      router.push('/feed');
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* el token pudo expirar; la sesión local se limpia igual */
    }
    clearSession();
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({ session, login, register, logout }),
    [session, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
