'use client';

import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Hash, Plus } from 'lucide-react';
import { normalizeTag, useTagSuggestions } from '@/lib/queries';
import { cx } from './ui';

// "#" + lo escrito hasta el cursor, sin venir pegado a otra palabra.
const TOKEN_BEFORE_CARET = /(?:^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]{0,40})$/u;

type Field = HTMLTextAreaElement | HTMLInputElement;

// Autocompletado de hashtags para un campo de texto controlado. Mientras el
// cursor está sobre "#algo" sugiere los hashtags que ya existen (los más usados
// primero) y permite crear uno nuevo; Enter/Tab o clic lo inserta.
export function useHashtagAutocomplete({
  value,
  setValue,
  fieldRef,
}: {
  value: string;
  setValue: (v: string) => void;
  fieldRef: React.RefObject<Field | null>;
}) {
  const listId = useId();
  const [token, setToken] = useState<{ query: string; start: number; end: number } | null>(null);
  const [debounced, setDebounced] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(token ? token.query : null), 120);
    return () => window.clearTimeout(id);
  }, [token]);

  const { data: suggestions = [] } = useTagSuggestions(debounced);
  const typed = token ? normalizeTag(token.query) : '';
  const options = [
    ...suggestions.map((s) => ({ tag: s.tag, count: s.count as number | null })),
    ...(typed.length >= 2 && !suggestions.some((s) => s.tag === typed) ? [{ tag: typed, count: null }] : []),
  ];
  const open = token !== null && options.length > 0;

  function detect(el: Field | null) {
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    if (caret !== el.selectionEnd) return setToken(null);
    const match = el.value.slice(0, caret).match(TOKEN_BEFORE_CARET);
    if (!match) return setToken(null);
    setToken({ query: match[1], start: caret - match[1].length - 1, end: caret });
    setActive(0);
  }

  function choose(tag: string) {
    if (!token) return;
    const before = value.slice(0, token.start);
    const after = value.slice(token.end).replace(/^[\p{L}\p{N}_]*/u, '');
    const insert = `#${tag}${after.startsWith(' ') ? '' : ' '}`;
    setValue(before + insert + after);
    setToken(null);
    const caret = before.length + insert.length;
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<Field>) {
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + delta + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      choose(options[Math.min(active, options.length - 1)].tag);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setToken(null);
    }
  }

  const fieldProps = {
    role: 'combobox' as const,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': open,
    'aria-controls': listId,
    'aria-activedescendant': open ? `${listId}-${active}` : undefined,
    onKeyDown,
    onKeyUp: (e: React.KeyboardEvent<Field>) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) detect(e.currentTarget);
    },
    onClick: (e: React.MouseEvent<Field>) => detect(e.currentTarget),
    onBlur: () => window.setTimeout(() => setToken(null), 120),
    // Llamar desde onChange después de actualizar el valor.
    detect: () => detect(fieldRef.current),
  };

  const popover = (
    <AnimatePresence>
      {open && (
        <motion.ul
          id={listId}
          role="listbox"
          aria-label="Hashtags sugeridos"
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          style={{ originY: 0 }}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-border bg-bg p-1.5 shadow-elevated sm:right-auto sm:min-w-72"
        >
          {options.map((o, i) => (
            <li
              key={o.tag}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o.tag);
              }}
              onMouseEnter={() => setActive(i)}
              className={cx(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3',
                i === active ? 'bg-surface' : '',
              )}
            >
              <span
                className={cx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  i === active ? 'bg-accent text-accent-ink' : 'bg-surface-hover',
                )}
              >
                {o.count === null ? <Plus size={15} aria-hidden /> : <Hash size={15} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1 truncate font-bold">#{o.tag}</span>
              <span className="shrink-0 text-xs text-fg-muted">
                {o.count === null ? 'Crear nuevo' : `${o.count} ${o.count === 1 ? 'publicación' : 'publicaciones'}`}
              </span>
            </li>
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  );

  return { fieldProps, popover };
}
