'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Hash, Search, TrendingUp, X } from 'lucide-react';
import {
  normalizeTag,
  usePostList,
  useProfiles,
  useSearch,
  useTagSuggestions,
  useUserSearch,
} from '@/lib/queries';
import { FollowerItem, Post, PostType, TagCount } from '@/lib/types';
import { Session } from '@/lib/session';
import { Protected } from '@/components/protected';
import { PostCard } from '@/components/post-card';
import { FollowButton } from '@/components/follow-button';
import { FilterChips, type Filter } from '@/components/filter-chips';
import { OwnActivity } from '@/components/own-activity';
import { Avatar, EmptyState, Spinner, cx } from '@/components/ui';

export default function ExplorarPage() {
  return (
    <Protected>
      {(session) => (
        <Suspense fallback={<Spinner />}>
          <Explorar session={session} />
        </Suspense>
      )}
    </Protected>
  );
}

// Un solo buscador: "calculo" encuentra temas (#calculo2, #calculo1…),
// personas por nombre y publicaciones con esos hashtags o la palabra en el
// texto. "/explorar?tag=calculo2" muestra todo lo de un tema.
function Explorar({ session }: { session: Session }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tag = params.get('tag') ? normalizeTag(params.get('tag')!) : null;
  const [input, setInput] = useState(params.get('q') ?? '');
  const [term, setTerm] = useState(input);
  const [filter, setFilter] = useState<Filter>('ALL');
  const type = filter === 'ALL' ? undefined : filter;

  // La búsqueda se lanza al dejar de escribir y queda en la URL (sirve el "atrás").
  useEffect(() => {
    const id = window.setTimeout(() => {
      setTerm(input);
      const q = input.trim();
      if (!tag && (params.get('q') ?? '') !== q) {
        router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [input, tag, params, pathname, router]);

  function openTag(next: string) {
    setInput('');
    router.push(`${pathname}?tag=${encodeURIComponent(next)}`);
  }

  function clear() {
    setInput('');
    setTerm('');
    router.replace(pathname, { scroll: false });
  }

  const searching = !tag && term.trim().replace(/^[@#]/, '').length >= 2;

  return (
    <>
      <header className="sticky top-16 z-20 border-b border-border bg-overlay backdrop-blur-md">
        <h1 className="sr-only">Explorar</h1>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const q = input.trim();
            // "#tema" + Enter abre el tema directamente.
            if (q.startsWith('#') && normalizeTag(q).length >= 2) openTag(normalizeTag(q));
            else setTerm(input);
          }}
          className="px-4 pb-1 pt-3 sm:px-5"
        >
          <label className="group flex h-12 items-center gap-3 rounded-xl border border-transparent bg-surface px-4 transition-[border-color,background-color,box-shadow] focus-within:border-fg focus-within:bg-bg focus-within:shadow-[0_0_0_4px_var(--accent-soft)]">
            <Search size={18} className="shrink-0 text-fg-muted group-focus-within:text-fg" aria-hidden />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Busca un tema, #hashtag o persona"
              aria-label="Buscar temas, hashtags o personas"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-muted"
            />
            {(input || tag) && (
              <button
                type="button"
                onClick={clear}
                aria-label="Limpiar búsqueda"
                className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </label>
        </form>
        <FilterChips id="explore" value={filter} onChange={setFilter} />
      </header>

      {tag ? (
        <TagView tag={tag} type={type} session={session} onClear={clear} />
      ) : searching ? (
        <SearchResults term={term} type={type} session={session} onTag={openTag} />
      ) : (
        <Discover type={type} session={session} onTag={openTag} />
      )}
    </>
  );
}

function Discover({
  type,
  session,
  onTag,
}: {
  type: PostType | undefined;
  session: Session;
  onTag: (tag: string) => void;
}) {
  const { data: trending } = useTagSuggestions('');
  // Lo propio no aparece en Explorar (salvo en "Actividad en tus publicaciones").
  const { data: page } = usePostList({ type, excludeAuthorId: session.userId, limit: 30 });

  return (
    <>
      {trending && trending.length > 0 && (
        <section className="border-b border-border px-4 py-4 sm:px-5" aria-labelledby="temas-populares">
          <h2
            id="temas-populares"
            className="mb-3 flex items-center gap-2 font-display text-[15px] font-extrabold tracking-tight"
          >
            <TrendingUp size={16} aria-hidden /> Temas populares
          </h2>
          <TagList tags={trending} onTag={onTag} />
        </section>
      )}
      <OwnActivity userId={session.userId} type={type} />
      <PostResults
        posts={page?.items ?? null}
        session={session}
        empty={{ title: 'Nada por aquí todavía', body: 'Cuando alguien publique algo de este tipo, lo verás aquí.' }}
      />
    </>
  );
}

function SearchResults({
  term,
  type,
  session,
  onTag,
}: {
  term: string;
  type: PostType | undefined;
  session: Session;
  onTag: (tag: string) => void;
}) {
  const onlyPeople = term.trim().startsWith('@');
  const { data: result, isFetching } = useSearch(onlyPeople ? '' : term, type, session.userId);
  const { data: people } = useUserSearch(term);

  const tags = result?.tags ?? [];
  const visiblePeople = (people ?? []).filter((p) => p.userId !== session.userId).slice(0, 5);
  const nothing =
    !onlyPeople && !!result && tags.length === 0 && result.posts.length === 0 && visiblePeople.length === 0;

  return (
    <div aria-live="polite" aria-busy={isFetching}>
      {tags.length > 0 && (
        <Section title="Temas" icon={<Hash size={14} aria-hidden />}>
          <TagList tags={tags} onTag={onTag} highlight={normalizeTag(term)} />
        </Section>
      )}

      {visiblePeople.length > 0 && (
        <Section title="Personas">
          <PeopleResults people={visiblePeople} />
        </Section>
      )}

      {onlyPeople && people && visiblePeople.length === 0 && (
        <EmptyState title={`Nadie coincide con «${term.trim()}»`} body="Prueba con el nombre o parte del usuario." />
      )}

      {nothing && (
        <EmptyState
          title={`Sin resultados para «${term.trim()}»`}
          body="Prueba con otra palabra, el nombre de una materia o un @usuario."
        />
      )}

      {!onlyPeople && !nothing && (
        <>
          <h2 className="px-4 pt-4 text-xs font-bold uppercase tracking-[0.08em] text-fg-muted sm:px-5">
            Publicaciones
          </h2>
          <PostResults
            posts={result?.posts ?? null}
            session={session}
            empty={{
              title: 'Ninguna publicación coincide',
              body: 'Puede que encuentres algo en los temas o personas de arriba.',
            }}
          />
        </>
      )}
    </div>
  );
}

function TagView({
  tag,
  type,
  session,
  onClear,
}: {
  tag: string;
  type: PostType | undefined;
  session: Session;
  onClear: () => void;
}) {
  const { data: page } = usePostList({ tag, type, excludeAuthorId: session.userId, limit: 30 });
  const { data: all } = usePostList({ tag, limit: 1 });

  return (
    <>
      <section className="paper-dots mx-4 my-4 flex items-center gap-4 rounded-2xl p-5 sm:mx-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
          <Hash size={24} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-2xl font-extrabold tracking-tight">#{tag}</h2>
          <p className="text-sm text-fg-muted">
            {all ? `${all.total} ${all.total === 1 ? 'publicación' : 'publicaciones'} con este tema` : 'Cargando…'}
          </p>
        </div>
        <button
          onClick={onClear}
          className="h-11 shrink-0 rounded-xl border border-border bg-bg px-3 text-sm font-bold transition-colors hover:bg-surface"
        >
          Ver todo
        </button>
      </section>
      <PostResults
        posts={page?.items ?? null}
        session={session}
        empty={{
          title: `Nada más en #${tag}`,
          body: 'Por ahora solo hay publicaciones tuyas con este tema, o ninguna de este tipo.',
        }}
      />
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-4 sm:px-5">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-fg-muted">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function TagList({ tags, onTag, highlight }: { tags: TagCount[]; onTag: (tag: string) => void; highlight?: string }) {
  return (
    <ul className="flex flex-wrap gap-2">
      <AnimatePresence initial={false}>
        {tags.map((t, i) => (
          <motion.li
            key={t.tag}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, delay: i * 0.02 }}
          >
            <button
              onClick={() => onTag(t.tag)}
              className={cx(
                'flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors pointer-coarse:h-11',
                t.tag === highlight ? 'border-fg bg-accent text-accent-ink' : 'border-border hover:bg-surface',
              )}
            >
              <span className="font-bold">#{t.tag}</span>
              <span className={cx('text-xs tabular-nums', t.tag === highlight ? 'opacity-70' : 'text-fg-muted')}>
                {t.count}
              </span>
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function PeopleResults({ people }: { people: FollowerItem[] }) {
  return (
    <ul className="-mx-3 flex flex-col">
      {people.map((p) => (
        <li key={p.userId} className="flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-surface">
          <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar firstName={p.firstName} lastName={p.lastName} avatarUrl={p.avatarUrl} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display font-extrabold tracking-tight">
                {p.firstName} {p.lastName}
              </span>
              <span className="block truncate text-sm text-fg-muted">@{p.username}</span>
            </span>
          </Link>
          <FollowButton userId={p.userId} />
        </li>
      ))}
    </ul>
  );
}

function PostResults({
  posts,
  session,
  empty,
}: {
  posts: Post[] | null;
  session: Session;
  empty: { title: string; body: string };
}) {
  const authors = useProfiles(posts?.map((p) => p.authorId) ?? []);
  if (!posts) return <Spinner />;
  if (posts.length === 0) return <EmptyState title={empty.title} body={empty.body} />;
  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} author={authors[post.authorId]} currentUserId={session.userId} />
      ))}
    </>
  );
}
