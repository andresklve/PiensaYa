'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useMounted } from './use-mounted';
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
  const queryClient = useQueryClient();

  // Al cambiar de cuenta se descarta la caché: nada de la sesión anterior
  // (a quién sigues, reacciones, mensajes) debe verse en la nueva.
  const login = useCallback(
    async (username: string, password: string) => {
      const auth = await api.auth.login({ username, password });
      queryClient.clear();
      saveSession(auth);
      router.push('/feed');
    },
    [router, queryClient],
  );

  const register = useCallback(
    async (body: {
      username: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      const auth = await api.auth.register(body);
      queryClient.clear();
      saveSession(auth);
      router.push('/feed');
    },
    [router, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* el token pudo expirar; la sesión local se limpia igual */
    }
    clearSession();
    queryClient.clear();
    router.push('/login');
  }, [router, queryClient]);

  const value = useMemo(
    () => ({ session, login, register, logout }),
    [session, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// El provider vive fuera del <Suspense> del layout: hidrata antes y ya expone la
// sesión real cuando el contenido suspendido recién está hidratando con el HTML
// del servidor (renderizado sin sesión). Cada consumidor ve null hasta montar.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  const mounted = useMounted();
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return mounted ? ctx : { ...ctx, session: null };
}
