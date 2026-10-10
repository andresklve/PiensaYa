'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

// La misma clave la lee el script de arranque de app/layout.tsx.
const KEY = 'piensaya.theme';

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const read = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => 'light');
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  root.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* almacenamiento bloqueado: el tema dura solo esta visita */
  }
  window.setTimeout(() => root.classList.remove('theme-transition'), 300);
}
