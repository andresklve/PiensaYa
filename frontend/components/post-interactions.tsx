'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Angry,
  Frown,
  Highlighter,
  Lightbulb,
  MessageCircle,
  Smile,
  SmilePlus,
  ThumbsDown,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useMyReaction } from '@/lib/my-reactions';
import { useAddComment, useComments, useProfiles, useReactMutation, useRemoveComment } from '@/lib/queries';
import { Post, REACTIONS, ReactionType } from '@/lib/types';
import { Avatar, Button, ErrorText, cx, timeAgo } from './ui';
import { RichText } from './rich-text';

// Reacciones monocromas: el único color es el amarillo de la reacción propia.
export const REACTION_ICON: Record<ReactionType, LucideIcon> = {
  LIKE: Highlighter,
  INTERESANTE: Lightbulb,
  FELIZ: Smile,
  TRISTE: Frown,
  ENOJADO: Angry,
  DISLIKE: ThumbsDown,
};

const POP = { scale: [1, 1.35, 0.92, 1], rotate: [0, -12, 6, 0] };

export function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const [prev, setPrev] = useState(value);
  const [direction, setDirection] = useState(1);
  if (value !== prev) {
    setDirection(value > prev ? 1 : -1);
    setPrev(value);
  }

  return (
    <span className={cx('relative inline-flex h-5 min-w-[1ch] overflow-hidden tabular-nums', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 14 * direction, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14 * direction, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 600, damping: 32 }}
        >
          {value > 0 ? value : ''}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const actionClass =
  'group flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm transition-colors duration-150 hover:bg-surface disabled:pointer-events-none';

function CommentAction({ count, href, onClick }: { count: number; href?: string; onClick?: () => void }) {
  const content = (
    <>
      <MessageCircle size={18} strokeWidth={1.9} aria-hidden />
      <AnimatedCount value={count} />
    </>
  );
  const className = cx(actionClass, 'text-fg-muted hover:text-fg');
  if (href) {
    return (
      <Link href={href} aria-label={`Comentar (${count})`} title="Comentar" className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={`Comentar (${count})`} title="Comentar" className={className}>
      {content}
    </button>
  );
}

export function ReactionBar({
  post,
  currentUserId,
  commentHref,
  onComment,
  className,
  trailing,
}: {
  post: Post;
  currentUserId: string;
  commentHref?: string;
  onComment?: () => void;
  className?: string;
  trailing?: React.ReactNode;
}) {
  const mine = useMyReaction(currentUserId, post.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const react = useReactMutation(currentUserId);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !pickerRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [pickerOpen]);

  // Optimista y compartido: el conteo cambia en el feed, el perfil y el detalle a la vez.
  function choose(type: ReactionType) {
    setPickerOpen(false);
    if (!currentUserId) return;
    react.mutate({ post, type, mine });
  }

  const underlined = mine === 'LIKE';
  const others = REACTIONS.filter((r) => r.type !== 'LIKE');
  const othersTotal = others.reduce((sum, r) => sum + (post.reactions[r.type] ?? 0), 0);
  const mineOther = mine && mine !== 'LIKE' ? mine : null;
  const MineIcon = mineOther ? REACTION_ICON[mineOther] : SmilePlus;

  return (
    <div className={className}>
      <div className="-ml-2.5 flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => choose('LIKE')}
          disabled={!currentUserId}
          aria-pressed={underlined}
          aria-label={`Subrayar (${post.reactions.LIKE ?? 0})`}
          title={underlined ? 'Quitar subrayado' : 'Subrayar'}
          className={cx(actionClass, underlined ? 'font-bold text-fg' : 'text-fg-muted hover:text-fg')}
        >
          <motion.span
            key={underlined ? 'on' : 'off'}
            initial={false}
            animate={underlined ? POP : { scale: 1 }}
            transition={{ duration: 0.42, ease: 'easeOut' }}
            className="flex"
          >
            <Highlighter size={18} strokeWidth={underlined ? 2.4 : 1.9} aria-hidden />
          </motion.span>
          <span className={cx('mark-swipe', underlined && 'is-on')}>{underlined ? 'Subrayado' : 'Subrayar'}</span>
          <AnimatedCount value={post.reactions.LIKE ?? 0} />
        </button>

        <div ref={pickerRef} className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={!currentUserId}
            aria-expanded={pickerOpen}
            aria-label={
              mineOther ? `Tu reacción: ${REACTIONS.find((r) => r.type === mineOther)?.label}` : `Reaccionar (${othersTotal})`
            }
            title="Reaccionar"
            className={cx(actionClass, mineOther ? 'text-fg' : 'text-fg-muted hover:text-fg')}
          >
            <motion.span
              key={mineOther ?? 'none'}
              initial={false}
              animate={mineOther ? POP : { scale: 1 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
              className={cx('flex h-7 w-7 items-center justify-center rounded-lg', mineOther && 'bg-accent text-accent-ink')}
            >
              <MineIcon size={18} strokeWidth={mineOther ? 2.3 : 1.9} aria-hidden />
            </motion.span>
            <AnimatedCount value={othersTotal} />
          </button>
          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                role="menu"
                aria-label="Elegir reacción"
                initial={{ opacity: 0, scale: 0.85, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                className="absolute bottom-full left-0 z-30 mb-2 flex gap-1 rounded-2xl border border-border bg-bg p-1.5 shadow-elevated"
                style={{ originX: 0, originY: 1 }}
              >
                {others.map(({ type, label }, i) => {
                  const Icon = REACTION_ICON[type];
                  const selected = mine === type;
                  return (
                    <motion.button
                      key={type}
                      role="menuitemradio"
                      aria-checked={selected}
                      aria-label={label}
                      title={label}
                      onClick={() => choose(type)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.16 }}
                      whileHover={{ scale: 1.18, y: -3 }}
                      whileTap={{ scale: 0.9 }}
                      className={cx(
                        'flex h-11 w-11 items-center justify-center rounded-xl',
                        selected ? 'bg-accent text-accent-ink' : 'text-fg hover:bg-surface',
                      )}
                    >
                      <Icon size={21} strokeWidth={2} aria-hidden />
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <CommentAction count={post.commentsCount} href={commentHref} onClick={onComment} />

        <span className="flex-1" />
        {trailing}
        <ReactionSummary post={post} />
      </div>
      <ErrorText error={react.error} />
    </div>
  );
}

// Los tres tipos más usados, apilados, como resumen rápido.
function ReactionSummary({ post }: { post: Post }) {
  const top = REACTIONS.map((r) => ({ ...r, n: post.reactions[r.type] ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  if (top.length === 0) return null;
  return (
    <span
      className="hidden items-center -space-x-1.5 sm:flex"
      aria-label={top.map((t) => `${t.label}: ${t.n}`).join(', ')}
      title={top.map((t) => `${t.label}: ${t.n}`).join(' · ')}
    >
      {top.map((t) => {
        const Icon = REACTION_ICON[t.type];
        return (
          <span key={t.type} className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-bg bg-surface-hover text-fg">
            <Icon size={12} strokeWidth={2.3} aria-hidden />
          </span>
        );
      })}
    </span>
  );
}

export function CommentThread({
  postId,
  currentUserId,
  inputRef,
}: {
  postId: string;
  currentUserId: string;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const { data: comments, error: loadError } = useComments(postId);
  const addComment = useAddComment(postId);
  const removeComment = useRemoveComment(postId);
  const [draft, setDraft] = useState('');
  const authors = useProfiles([...(comments?.map((c) => c.authorId) ?? []), currentUserId].filter(Boolean));
  const me = authors[currentUserId];
  const busy = addComment.isPending || removeComment.isPending;
  const error = addComment.error ?? removeComment.error ?? loadError;

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    addComment.mutate(draft, { onSuccess: () => setDraft('') });
  };

  const remove = (commentId: string) => removeComment.mutate(commentId);

  return (
    <div>
      {currentUserId && (
        <form onSubmit={add} className="flex gap-3 border-b border-border px-4 py-4 sm:px-5">
          <Avatar firstName={me?.firstName} lastName={me?.lastName} avatarUrl={me?.avatarUrl} />
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor={`reply-${postId}`} className="sr-only">
              Escribe tu respuesta
            </label>
            <textarea
              id={`reply-${postId}`}
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Agrega tu comentario"
              rows={1}
              required
              className="field-sizing-content min-h-11 w-full resize-none rounded-xl bg-surface px-3.5 py-2.5 text-base outline-none transition-shadow placeholder:text-fg-subtle focus:shadow-[0_0_0_2px_var(--fg),0_0_0_6px_var(--accent-soft)]"
            />
            <div className="flex justify-end">
              <Button type="submit" variant="accent" size="sm" disabled={busy || !draft.trim()}>
                Comentar
              </Button>
            </div>
          </div>
        </form>
      )}
      <ErrorText error={error} />

      {comments?.length === 0 && (
        <p className="paper-dots m-4 rounded-2xl px-6 py-8 text-center text-fg-muted sm:m-5">
          Aún no hay comentarios. Abre la conversación con una pregunta o un dato.
        </p>
      )}
      <ul>
        <AnimatePresence initial={false}>
          {comments?.map((comment) => {
            const author = authors[comment.authorId];
            const mine = comment.authorId === currentUserId;
            return (
              <motion.li
                key={comment.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex gap-3 border-b border-dashed border-border px-4 py-3.5 sm:px-5"
              >
                <Avatar firstName={author?.firstName} lastName={author?.lastName} avatarUrl={author?.avatarUrl} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-sm">
                    {author ? (
                      <Link href={`/u/${author.username}`} className="truncate font-bold hover:underline">
                        {author.firstName} {author.lastName}
                      </Link>
                    ) : (
                      <span className="font-bold">{comment.authorId.slice(0, 8)}</span>
                    )}
                    {author && <span className="truncate text-fg-muted">@{author.username}</span>}
                    <span className="text-fg-muted">·</span>
                    <span className="shrink-0 text-fg-muted">{timeAgo(comment.createdAt)}</span>
                    {mine && (
                      <button
                        onClick={() => remove(comment.id)}
                        disabled={busy}
                        aria-label="Borrar comentario"
                        className="-my-2 ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed"><RichText text={comment.content} />
                  </p>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
