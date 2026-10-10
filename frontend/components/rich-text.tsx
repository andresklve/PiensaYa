'use client';

import Link from 'next/link';
import { normalizeTag } from '@/lib/queries';
import { cx } from './ui';

// Misma regla que el Post Service: # + letras/números/_ y que no venga pegado
// a otra palabra (así un ancla de URL o "a#b" no se convierten en enlace).
const HASHTAG_RE = /(^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]{2,40})/gu;

export function tagHref(tag: string) {
  return `/explorar?tag=${encodeURIComponent(normalizeTag(tag))}`;
}

// Texto con los #hashtags convertidos en enlaces al tema en Explorar.
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(HASHTAG_RE)) {
    const start = (match.index ?? 0) + match[1].length;
    if (start > last) parts.push(text.slice(last, start));
    const tag = match[2];
    parts.push(
      <Link
        key={start}
        href={tagHref(tag)}
        className="group font-bold text-fg decoration-fg/30 underline-offset-4 hover:underline"
      >
        <span className="mark-swipe-hover">#{tag}</span>
      </Link>,
    );
    last = start + tag.length + 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={cx(className)}>{parts}</span>;
}

// Fila de hashtags para la ficha de un artículo.
export function TagChips({ tags, className }: { tags?: string[]; className?: string }) {
  if (!tags?.length) return null;
  return (
    <ul className={cx('flex flex-wrap gap-1.5', className)} aria-label="Hashtags">
      {tags.slice(0, 6).map((tag) => (
        <li key={tag}>
          <Link
            href={tagHref(tag)}
            className="inline-flex h-7 items-center rounded-lg bg-surface px-2.5 text-xs font-bold text-fg transition-colors hover:bg-accent hover:text-accent-ink pointer-coarse:h-9"
          >
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
