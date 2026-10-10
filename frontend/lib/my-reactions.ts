'use client';

import { useSyncExternalStore } from 'react';
import { ReactionType } from './types';

// El Post Service solo devuelve conteos, no la reacción del usuario actual;
// la recordamos localmente para poder pintar el estado activo.
const KEY = 'piensaya.reactions';
type Store = Record<string, ReactionType>;

// Caché solo para que useSyncExternalStore reciba la misma referencia entre
// renders. Se descarta cuando otra pestaña escribe (evento `storage`).
let cache: Store | null = null;
const listeners = new Set<() => void>();

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
}

function read(): Store {
  if (!cache) cache = load();
  return cache;
}

function notify() {
  listeners.forEach((l) => l());
}

function onStorage(event: StorageEvent) {
  if (event.key !== KEY && event.key !== null) return;
  cache = null;
  notify();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

const keyFor = (userId: string, postId: string) => `${userId}:${postId}`;

export function useMyReaction(userId: string, postId: string): ReactionType | null {
  return useSyncExternalStore(
    subscribe,
    () => read()[keyFor(userId, postId)] ?? null,
    () => null,
  );
}

// Lee-modifica-escribe sobre lo que hay en localStorage en este momento, no
// sobre la copia en memoria: así no se pisan los cambios hechos en otra pestaña.
export function setMyReaction(userId: string, postId: string, type: ReactionType | null) {
  const next = load();
  if (type) next[keyFor(userId, postId)] = type;
  else delete next[keyFor(userId, postId)];
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sin almacenamiento: queda solo en memoria */
  }
  notify();
}
