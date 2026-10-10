'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MoreHorizontal, Quote, Trash2 } from 'lucide-react';
import { useDeletePost } from '@/lib/queries';
import { Post, Profile } from '@/lib/types';
import { ReactionBar } from './post-interactions';
import { RichText, TagChips } from './rich-text';
import { Avatar, ErrorText, cx, fullDate, timeAgo } from './ui';

// Tres formatos con jerarquía propia: el artículo es una ficha con borde para
// lectura larga; el apunte es texto libre con la hora en el margen; la
// opinión es una cita con comillas grandes.
// Sin estado propio: la publicación viene de la caché, así una reacción hecha
// en el detalle se ve igual en el feed y en el perfil.
export function PostCard({
  post,
  author,
  currentUserId,
  label,
}: {
  post: Post;
  author?: Profile | null;
  currentUserId: string;
  // Línea de contexto sobre la tarjeta ("Descubrimiento", "2 comentarios nuevos"…).
  label?: React.ReactNode;
}) {
  const router = useRouter();
  const deletePost = useDeletePost();
  const error = deletePost.error;
  const href = `/post/${post.id}`;

  // Toda la tarjeta navega al detalle, salvo los controles internos.
  function onCardClick(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('a,button,[role=menu]') || window.getSelection()?.toString()) return;
    router.push(href);
  }

  const remove = () => deletePost.mutate(post.id);

  const name = author ? `${author.firstName} ${author.lastName}` : post.authorId.slice(0, 8);
  const profileHref = author ? `/u/${author.username}` : `/u/${post.authorId}`;
  const menu = post.authorId === currentUserId ? <MoreMenu onDelete={remove} /> : null;
  const time = (
    <Link href={href} className="hover:underline" title={fullDate(post.createdAt)}>
      <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
    </Link>
  );
  const byline = (
    <div className="flex min-w-0 items-center gap-2.5">
      <Link href={profileHref} className="shrink-0 rounded-[10px]" aria-label={`Perfil de ${name}`}>
        <Avatar firstName={author?.firstName} lastName={author?.lastName} avatarUrl={author?.avatarUrl} size="xs" />
      </Link>
      <span className="min-w-0 truncate text-sm">
        <Link href={profileHref} className="font-bold hover:underline">
          {name}
        </Link>
        {author && <span className="text-fg-muted"> @{author.username}</span>}
      </span>
    </div>
  );
  const reactions = (
    <ReactionBar post={post} currentUserId={currentUserId} commentHref={`${href}#comentarios`} />
  );

  const labelRow = label ? (
    <div className="mx-3 -mb-1 mt-3 flex items-center gap-1.5 text-xs font-bold text-fg-muted sm:mx-5">{label}</div>
  ) : null;

  if (post.type === 'POST') {
    return (
      <>
      {labelRow}
      <article
        onClick={onCardClick}
        className="group/card mx-3 my-3 cursor-pointer rounded-2xl border border-border bg-bg px-4 pb-1.5 pt-4 transition-[border-color,box-shadow,transform] duration-200 hover:border-dot hover:shadow-elevated sm:mx-5 sm:px-5 sm:pt-5"
      >
        <div className="flex items-center gap-2 text-[13px] text-fg-muted">
          <span className="inline-flex h-6 items-center rounded-lg bg-surface px-2 text-xs font-bold tracking-wide text-fg">
            Artículo
          </span>
          <span>{readingTime(post.content)} min de lectura</span>
          <span aria-hidden>·</span>
          {time}
          <span className="ml-auto">{menu}</span>
        </div>
        <h2 className="mt-3 font-display text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[25px]">
          <Link href={href} className="rounded-sm">
            {post.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 text-base leading-relaxed text-fg/85">
          <RichText text={post.content} />
        </p>
        <TagChips tags={post.tags} className="mt-3" />
        <div className="mt-4 flex items-center justify-between gap-3">
          {byline}
          <Link
            href={href}
            className="hidden shrink-0 items-center gap-1 text-sm font-bold sm:inline-flex"
            tabIndex={-1}
            aria-hidden
          >
            <span className="mark-swipe-hover group-hover/card:bg-[length:100%_var(--mark-h)] group-hover/card:[color:var(--mark-ink)]">Leer</span>
            <ArrowRight size={16} className="transition-transform group-hover/card:translate-x-0.5" />
          </Link>
        </div>
        <div className="mt-1">{reactions}</div>
        <ErrorText error={error} />
      </article>
      </>
    );
  }

  const isOpinion = post.type === 'OPINION';

  return (
    <>
    {labelRow}
    <article
      onClick={onCardClick}
      className="mx-3 grid cursor-pointer grid-cols-[44px_minmax(0,1fr)] border-b border-dashed border-border pt-4 transition-colors sm:mx-5 sm:grid-cols-[72px_minmax(0,1fr)]"
    >
      <div className="mr-3 flex flex-col gap-1 border-r border-border pr-1.5 sm:mr-4 sm:pr-2">
        <span className="hidden text-[11px] font-bold uppercase tracking-[0.06em] text-fg-muted sm:block">
          {isOpinion ? 'Opinión' : 'Apunte'}
        </span>
        <span className="whitespace-nowrap text-xs tabular-nums text-fg-muted">{time}</span>
      </div>
      <div className="min-w-0 pb-1">
        <div className="flex items-center gap-2">
          {byline}
          <span className="ml-auto">{menu}</span>
        </div>
        {isOpinion ? (
          <blockquote className="relative mt-2.5 pl-8">
            <Quote size={22} className="absolute left-0 top-0.5 -scale-x-100 fill-fg text-fg" aria-hidden />
            <p className="whitespace-pre-wrap break-words font-display text-[18px] font-medium leading-snug tracking-[-0.01em]">
              <RichText text={post.content} />
            </p>
            <span className="sr-only">Opinión</span>
          </blockquote>
        ) : (
          <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed">
            <RichText text={post.content} />
          </p>
        )}
        <div className="mt-1">{reactions}</div>
        <ErrorText error={error} />
      </div>
    </article>
    </>
  );
}

export function readingTime(text: string): number {
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / 200));
}

function MoreMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative -my-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Más opciones"
        aria-expanded={open}
        className={cx(
          'flex h-9 w-9 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-surface hover:text-fg pointer-coarse:h-11 pointer-coarse:w-11',
          open && 'bg-surface text-fg',
        )}
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ originX: 1, originY: 0 }}
            className="absolute right-0 top-full z-30 mt-1 min-w-48 overflow-hidden rounded-2xl border border-border bg-bg p-1.5 shadow-elevated"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-bold text-danger transition-colors hover:bg-danger-soft"
            >
              <Trash2 size={18} aria-hidden /> Eliminar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
