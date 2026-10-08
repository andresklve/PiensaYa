import { AuthResponse } from './types';

const KEY = 'piensaya.session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
}

// Store externo sobre localStorage: React lo lee con useSyncExternalStore, que
// devuelve null en el servidor y el valor real tras hidratar, sin desajustes.
let cache: Session | null | undefined;
const listeners = new Set<() => void>();

function read(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function emit(next: Session | null): void {
  cache = next;
  listeners.forEach((listener) => listener());
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSessionSnapshot(): Session | null {
  if (cache === undefined) cache = read();
  return cache;
}

export const getServerSessionSnapshot = (): Session | null => null;

export function getSession(): Session | null {
  return getSessionSnapshot();
}

export function saveSession(auth: AuthResponse): Session {
  const session: Session = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    userId: auth.userId,
    username: auth.username,
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  emit(session);
  return session;
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
  emit(null);
}
