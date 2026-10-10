'use client';

import { cx } from './ui';

export function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />}
        <span className={cx('relative inline-flex h-2 w-2 rounded-full', connected ? 'bg-accent ring-1 ring-fg/30' : 'bg-fg-subtle')} />
      </span>
      {connected ? 'En tiempo real' : 'Reconectando…'}
    </span>
  );
}
