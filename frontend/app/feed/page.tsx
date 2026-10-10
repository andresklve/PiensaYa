'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, RefreshCw } from 'lucide-react';
import { useFollowing, useFollowingFeed, useForYou, useProfiles } from '@/lib/queries';
import { Post, ForYouItem } from '@/lib/types';
import { Session } from '@/lib/session';
import { Protected } from '@/components/protected';
import { Composer } from '@/components/composer';
import { PostCard } from '@/components/post-card';
import { Tabs } from '@/components/tabs';
import { FilterChips, type Filter } from '@/components/filter-chips';
import { OwnActivity } from '@/components/own-activity';
import { ButtonLink, EmptyState, ErrorText, Spinner, cx } from '@/components/ui';

// "Para ti" es la pestaña por defecto: mezcla 3 publicaciones de quienes sigues
// por 1 de descubrimiento (Feed Service) y nunca muestra lo propio, salvo en
// "Actividad en tus publicaciones" cuando alguien interactuó. Un usuario nuevo
// ve solo descubrimiento, nunca un feed vacío.
type Tab = 'all' | 'following';

const EMPTY_BY_FILTER: Record<Filter, string> = {
  ALL: 'publicaciones',
  POST: 'artículos',
  TWEET: 'apuntes',
  OPINION: 'opiniones',
};

export default function FeedPage() {
  return <Protected>{(session) => <Feed session={session} />}</Protected>;
}

function Feed({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('all');
  const [filter, setFilter] = useState<Filter>('ALL');
  const type = filter === 'ALL' ? undefined : filter;

  // El filtro de "Para ti" se aplica en el servidor; el de "Siguiendo", sobre
  // el feed ya armado en Redis.
  const forYou = useForYou(type, tab === 'all');
  const followingFeed = useFollowingFeed(tab === 'following');
  const following = useFollowing(session.userId);

  const query = tab === 'all' ? forYou : followingFeed;
  const posts: (Post | ForYouItem)[] | undefined =
    tab === 'all' ? forYou.data : followingFeed.data?.filter((p) => !type || p.type === type);
  const authors = useProfiles(posts?.map((p) => p.authorId) ?? []);
  const followsNobody = following.data?.length === 0;

  return (
    <>
      <header className="sticky top-16 z-20 border-b border-border bg-overlay backdrop-blur-md">
        <h1 className="sr-only">Inicio</h1>
        <div className="flex items-center">
          <Tabs
            id="feed"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'all', label: 'Para ti' },
              { value: 'following', label: 'Siguiendo' },
            ]}
          />
          <span className="flex-1" />
          <button
            onClick={() => void query.refetch()}
            aria-label="Actualizar el feed"
            title="Actualizar"
            className="mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-surface hover:text-fg sm:mr-3"
          >
            <RefreshCw size={17} className={cx(query.isFetching && 'animate-spin')} aria-hidden />
          </button>
        </div>
        <FilterChips id="feed" value={filter} onChange={setFilter} />
      </header>

      <Composer />

      {tab === 'all' && <OwnActivity userId={session.userId} type={type} />}

      <ErrorText error={query.error} />
      {!posts && !query.error && <Spinner />}

      {posts?.length === 0 && (
        <EmptyState
          title={
            tab === 'following' && followsNobody
              ? 'Tu cuaderno está en blanco'
              : `No hay ${EMPTY_BY_FILTER[filter]} todavía`
          }
          body={
            tab === 'following' && followsNobody
              ? 'Cuando sigas a otras personas, sus apuntes, opiniones y artículos aparecerán aquí.'
              : tab === 'following'
                ? 'Las nuevas publicaciones de quienes sigues aparecerán aquí en cuanto las compartan.'
                : 'Sé la primera persona en compartir algo de este tipo.'
          }
          action={
            tab === 'following' && followsNobody ? (
              <ButtonLink href="/explorar" variant="primary">
                Buscar personas
              </ButtonLink>
            ) : undefined
          }
        />
      )}

      <AnimatePresence initial={false}>
        {posts?.map((post, i) => (
          <motion.div
            key={post.id}
            layout="position"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut', delay: Math.min(i, 8) * 0.04 }}
          >
            <PostCard
              post={post}
              author={authors[post.authorId]}
              currentUserId={session.userId}
              label={
                'reason' in post && post.reason === 'discovery' ? (
                  <>
                    <Compass size={14} aria-hidden /> Descubrimiento · alguien que aún no sigues
                  </>
                ) : undefined
              }
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
}
