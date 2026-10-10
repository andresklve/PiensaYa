'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useCreatePost, useProfiles } from '@/lib/queries';
import { POST_LIMITS, PostType } from '@/lib/types';
import { Avatar, Button, ErrorText, cx } from './ui';
import { useHashtagAutocomplete } from './hashtag-autocomplete';

const TYPES: { value: PostType; label: string; placeholder: string }[] = [
  { value: 'TWEET', label: 'Apunte', placeholder: '¿Qué estás estudiando hoy?' },
  { value: 'OPINION', label: 'Opinión', placeholder: '¿Qué piensas sobre un tema? Argumenta tu postura.' },
  { value: 'POST', label: 'Artículo', placeholder: 'Desarrolla tu idea. Separa los párrafos con una línea en blanco.' },
];

export function Composer() {
  const { session } = useAuth();
  const me = useProfiles(session ? [session.userId] : [])[session?.userId ?? ''];
  const [type, setType] = useState<PostType>('TWEET');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [focused, setFocused] = useState(false);
  const createPost = useCreatePost();
  const [published, setPublished] = useState(false);
  const busy = createPost.isPending;
  const error = createPost.error;
  const textRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const hashtags = useHashtagAutocomplete({ value: content, setValue: setContent, fieldRef: textRef });
  const { detect, ...hashtagFieldProps } = hashtags.fieldProps;
  const hasTags = /(^|[^\p{L}\p{N}_&/])#[\p{L}\p{N}_]{2,}/u.test(content);

  const expanded = focused || content.length > 0 || title.length > 0 || type === 'POST';
  const limit = POST_LIMITS[type];
  const tooLong = limit !== undefined && content.length > limit;
  const canPost = content.trim().length > 0 && (type !== 'POST' || title.trim().length > 0) && !tooLong;

  useEffect(() => {
    const focusIfRequested = () => {
      if (window.location.hash === '#composer') {
        textRef.current?.focus();
        rootRef.current?.scrollIntoView({ block: 'start' });
      }
    };
    focusIfRequested();
    window.addEventListener('hashchange', focusIfRequested);
    return () => window.removeEventListener('hashchange', focusIfRequested);
  }, []);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canPost) return;
    createPost.mutate(
      { type, content, title: type === 'POST' ? title : undefined },
      {
        onSuccess: () => {
          setPublished(true);
          window.setTimeout(() => setPublished(false), 6000);
          setTitle('');
          setContent('');
          setType('TWEET');
          textRef.current?.blur();
        },
      },
    );
  }

  return (
    <form
      ref={rootRef}
      onSubmit={onSubmit}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
      className="flex scroll-mt-32 gap-3 border-b border-border px-4 pb-3 pt-4 sm:px-5"
    >
      <Avatar firstName={me?.firstName} lastName={me?.lastName} avatarUrl={me?.avatarUrl} />
      <div className="relative min-w-0 flex-1">
        {!expanded && (
          <div className="absolute right-0 top-1 z-10 hidden gap-1.5 sm:flex">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setType(t.value);
                  if (t.value === 'POST') setFocused(true);
                  else textRef.current?.focus();
                }}
                className="h-9 rounded-xl border border-border px-3 text-sm font-bold transition-colors hover:bg-surface pointer-coarse:h-11"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="type"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <TypeSwitch value={type} onChange={setType} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {type === 'POST' && (
            <motion.input
              key="title"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 44, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del artículo"
              aria-label="Título del artículo"
              autoFocus
              className="-mx-2.5 w-[calc(100%+1.25rem)] rounded-xl px-2.5 outline-none transition-shadow duration-150 focus:shadow-[0_0_0_1.5px_var(--fg),0_0_0_5px_var(--accent-soft)] bg-transparent font-display text-2xl font-extrabold tracking-tight placeholder:text-fg-subtle"
            />
          )}
        </AnimatePresence>

        <div className="relative">
        <motion.textarea
          id="composer"
          ref={textRef}
          value={content}
          {...hashtagFieldProps}
          onChange={(e) => {
            setContent(e.target.value);
            detect();
          }}
          placeholder={TYPES.find((t) => t.value === type)?.placeholder}
          aria-label="Contenido de la publicación"
          animate={{ minHeight: expanded ? (type === 'POST' ? 180 : type === 'OPINION' ? 120 : 88) : 44 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cx(
            'field-sizing-content block resize-none bg-transparent py-2 text-lg leading-relaxed placeholder:text-fg-muted',
            '-mx-2.5 w-[calc(100%+1.25rem)] rounded-xl px-2.5 outline-none transition-shadow duration-150 focus:shadow-[0_0_0_1.5px_var(--fg),0_0_0_5px_var(--accent-soft)]',
            !expanded && 'sm:pr-[17.5rem]',
          )}
        />
        {hashtags.popover}
        </div>
        {expanded && !hasTags && (
          <p className="pb-1 text-xs text-fg-muted">
            Agrega <span className="font-bold text-fg">#hashtags</span> para que te encuentren por tema, por ejemplo{' '}
            <span className="font-bold text-fg">#calculo2</span>.
          </p>
        )}

        <ErrorText error={error} />
        <AnimatePresence>
          {published && (
            <motion.p
              role="status"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-sm"
            >
              Publicado. Lo verás en tu perfil y en Siguiendo; en Para ti aparecerá cuando alguien comente o reaccione.
            </motion.p>
          )}
        </AnimatePresence>

        <div
          className={cx(
            'flex items-center justify-end gap-3 pt-2 transition-[border-color] duration-200',
            expanded ? 'border-t border-dashed border-border' : 'hidden',
          )}
        >
          {limit !== undefined && content.length > 0 && <CharRing count={content.length} max={limit} />}
          {type === 'POST' && (
            <span className="text-sm text-fg-muted">
              {content.trim() ? content.trim().split(/\s+/).length : 0} palabras
            </span>
          )}
          <Button type="submit" variant="accent" size="sm" disabled={busy || !canPost}>
            {busy ? 'Publicando…' : 'Publicar'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function TypeSwitch({ value, onChange }: { value: PostType; onChange: (v: PostType) => void }) {
  const options = TYPES;
  return (
    <div role="radiogroup" aria-label="Tipo de publicación" className="mb-2 inline-flex rounded-xl bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative h-8 rounded-lg px-4 text-sm font-bold transition-colors duration-150 pointer-coarse:h-10',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId="composer-type"
                className="absolute inset-0 rounded-lg bg-bg shadow-[0_1px_3px_rgb(0_0_0/0.14)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function CharRing({ count, max }: { count: number; max: number }) {
  const remaining = max - count;
  const r = 10;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, count / max);
  const color = remaining < 0 ? 'var(--danger)' : 'var(--fg)';
  const big = remaining <= 20;

  return (
    <div className="flex items-center gap-2" aria-live="polite" aria-label={`${remaining} caracteres restantes`}>
      <motion.svg
        width={30}
        height={30}
        viewBox="0 0 30 30"
        animate={{ scale: big ? 1.15 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className="-rotate-90"
      >
        <circle cx="15" cy="15" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle
          cx="15"
          cy="15"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 150ms ease-out, stroke 150ms' }}
        />
      </motion.svg>
      {big && (
        <span className={cx('text-sm tabular-nums', remaining < 0 ? 'text-danger' : 'text-fg-muted')}>
          {remaining}
        </span>
      )}
    </div>
  );
}
