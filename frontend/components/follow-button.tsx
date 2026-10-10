'use client';

import { motion } from 'framer-motion';
import { useFollowMutation, useIsFollowing } from '@/lib/queries';
import { cx } from './ui';

// Sin estado propio: lee "¿lo sigo?" de la caché compartida, así el botón del
// perfil, el del panel de sugerencias y el del detalle siempre coinciden.
export function FollowButton({ userId, size = 'sm' }: { userId: string; size?: 'sm' | 'md' }) {
  const following = useIsFollowing(userId);
  const follow = useFollowMutation();

  return (
    <motion.button
      onClick={() => follow.mutate({ userId, follow: !following })}
      disabled={following === undefined}
      whileTap={{ scale: 0.92 }}
      aria-pressed={!!following}
      className={cx(
        'group relative inline-flex shrink-0 items-center justify-center rounded-xl font-bold transition-colors duration-150 disabled:opacity-40',
        size === 'sm' ? 'h-9 px-3.5 text-sm pointer-coarse:min-h-11' : 'h-11 px-5 text-[15px]',
        following
          ? 'min-w-[8.5rem] border border-border bg-bg text-fg hover:border-danger/40 hover:bg-danger-soft hover:text-danger'
          : 'bg-fg text-bg hover:opacity-90',
      )}
    >
      {following ? (
        <>
          <span className="group-hover:hidden">Siguiendo</span>
          <span className="hidden group-hover:inline">Dejar de seguir</span>
        </>
      ) : (
        'Seguir'
      )}
    </motion.button>
  );
}
