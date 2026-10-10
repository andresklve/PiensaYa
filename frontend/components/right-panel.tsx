'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { Hash } from 'lucide-react';
import { useFollowing, usePostList, useProfile, useProfiles, useTagSuggestions } from '@/lib/queries';
import { tagHref } from './rich-text';
import { Avatar, TextLink, compactNumber } from './ui';
import { FollowButton } from './follow-button';

export function RightPanel() {
  return (
    <div className="flex flex-col gap-4 py-5">
      <MySummary />
      <TrendingTags />
      <WhoToFollow />
    </div>
  );
}

// Tarjeta "tu cuaderno": perfil propio con contadores reales. Lee de la misma
// caché que el resto de la app, así seguir a alguien actualiza "Siguiendo".
function MySummary() {
  const { session } = useAuth();
  const { data: me } = useProfile(session?.userId);
  const { data: mine } = usePostList({ authorId: session?.userId, limit: 1 }, !!session);

  if (!me) return null;

  const stats = [
    { label: 'Publicado', value: mine?.total ?? 0 },
    { label: 'Seguidores', value: me.followersCount },
    { label: 'Siguiendo', value: me.followingCount },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border">
      {me.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen del almacenamiento propio
        <img src={me.coverUrl} alt="" className="h-14 w-full object-cover" />
      ) : (
        <div className="paper-dots h-14" aria-hidden />
      )}
      <div className="px-4 pb-4">
        <Link href="/perfil" className="-mt-7 flex items-end gap-3">
          <Avatar firstName={me.firstName} lastName={me.lastName} avatarUrl={me.avatarUrl} size="md" className="ring-4 ring-bg" />
          <span className="min-w-0 pb-0.5 leading-tight">
            <span className="block truncate font-display font-extrabold tracking-tight">
              {me.firstName} {me.lastName}
            </span>
            <span className="block truncate text-sm text-fg-muted">@{me.username}</span>
          </span>
        </Link>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 rounded-xl bg-surface px-1.5 py-2">
              <dt className="truncate text-xs text-fg-muted">{s.label}</dt>
              <dd className="font-display text-lg font-extrabold tabular-nums">{compactNumber(s.value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// Los hashtags más usados de la comunidad.
function TrendingTags() {
  const { data: tags } = useTagSuggestions('');
  if (!tags?.length) return null;
  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="mb-2 font-display text-[17px] font-extrabold tracking-tight">Temas populares</h2>
      <ul className="flex flex-col">
        {tags.slice(0, 5).map((t) => (
          <li key={t.tag}>
            <Link
              href={tagHref(t.tag)}
              className="group -mx-2 flex min-h-11 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-surface"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                <Hash size={15} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{t.tag}</span>
              <span className="text-xs tabular-nums text-fg-muted">
                {t.count} {t.count === 1 ? 'publicación' : 'publicaciones'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// No hay endpoint de sugerencias: proponemos autores recientes que aún no
// sigues. Se recalcula desde la caché, así que al seguir a alguien desaparece
// de la lista al instante.
function WhoToFollow() {
  const { session } = useAuth();
  const { data: recent } = usePostList({ limit: 40 }, !!session);
  const { data: following } = useFollowing(session?.userId);

  const followed = new Set(following?.map((f) => f.userId));
  const candidates =
    session && recent && following
      ? [...new Set(recent.items.map((p) => p.authorId))]
          .filter((id) => id !== session.userId && !followed.has(id))
          .slice(0, 4)
      : [];
  const profiles = useProfiles(candidates);

  if (!session || !recent || !following) return null;

  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="mb-2 font-display text-[17px] font-extrabold tracking-tight">Compañeros por descubrir</h2>
      {candidates.length === 0 && (
        <p className="py-2 text-sm text-fg-muted">Ya sigues a todos los que publicaron hace poco.</p>
      )}
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {candidates.map((id) => {
            const p = profiles[id];
            if (!p) return null;
            return (
              <motion.li
                key={id}
                layout
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16, height: 0, paddingTop: 0, paddingBottom: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex items-center gap-3 overflow-hidden py-2"
              >
                <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar firstName={p.firstName} lastName={p.lastName} avatarUrl={p.avatarUrl} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-bold hover:underline">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="block truncate text-xs text-fg-muted">@{p.username}</span>
                  </span>
                </Link>
                <FollowButton userId={id} />
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <p className="mt-2 text-sm">
        <TextLink href="/explorar">Explorar más personas</TextLink>
      </p>
    </section>
  );
}
