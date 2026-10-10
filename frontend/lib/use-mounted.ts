'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => {};

// false en el servidor y durante la hidratación, true después: evita pintar
// datos de localStorage (sesión) que el HTML prerenderizado no puede conocer.
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
