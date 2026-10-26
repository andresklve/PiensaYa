'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { Hash } from 'lucide-react';
import { useFollowing, usePostList, useProfile, useSuggestions, useTagSuggestions } from '@/lib/queries';
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

// Sugerencias del User & Follow Service: primero gente que siguen quienes
// sigues. Se filtra con la caché de seguidos, así al seguir a alguien
// desaparece al instante (y luego se recarga la lista).
function WhoToFollow() {
  const { session } = useAuth();
  const { data: suggestions } = useSuggestions();
  const { data: following } = useFollowing(session?.userId);

  if (!session || !suggestions || !following) return null;

  const followed = new Set(following.map((f) => f.userId));
  const people = suggestions.filter((p) => !followed.has(p.userId)).slice(0, 4);

  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="mb-2 font-display text-[17px] font-extrabold tracking-tight">Compañeros por descubrir</h2>
      {people.length === 0 && (
        <p className="py-2 text-sm text-fg-muted">Por ahora no hay a nadie más que sugerirte.</p>
      )}
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {people.map((p) => (
            <motion.li
              key={p.userId}
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
                  <span className="block truncate text-xs text-fg-muted">
                    {p.mutualCount > 0
                      ? `Lo ${p.mutualCount === 1 ? 'sigue 1 persona' : `siguen ${p.mutualCount} personas`} que sigues`
                      : `@${p.username}`}
                  </span>
                </span>
              </Link>
              <FollowButton userId={p.userId} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <p className="mt-2 text-sm">
        <TextLink href="/explorar">Explorar más personas</TextLink>
      </p>
    </section>
  );
}
