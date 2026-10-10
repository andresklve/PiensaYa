'use client';

import { motion } from 'framer-motion';
import { PostType } from '@/lib/types';
import { cx } from './ui';

export type Filter = 'ALL' | PostType;

export const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Todo' },
  { value: 'POST', label: 'Artículos' },
  { value: 'TWEET', label: 'Apuntes' },
  { value: 'OPINION', label: 'Opiniones' },
];

export function FilterChips({
  value,
  onChange,
  id,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  id: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tipo de publicación"
      className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:px-5"
    >
      {FILTERS.map((f) => {
        const active = f.value === value;
        return (
          <button
            key={f.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(f.value)}
            className={cx(
              'relative h-9 shrink-0 rounded-xl px-3.5 text-sm font-bold transition-colors pointer-coarse:h-11',
              active ? 'text-bg' : 'border border-border text-fg-muted hover:bg-surface hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId={`filter-${id}`}
                className="absolute inset-0 rounded-xl bg-fg"
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative">{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}
