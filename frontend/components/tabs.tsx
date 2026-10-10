'use client';

import { motion } from 'framer-motion';
import { cx } from './ui';

// El indicador es un trazo de marcador detrás de la etiqueta activa que se
// desliza (layoutId) de una pestaña a otra.
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  id,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  id: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx('flex gap-1 overflow-x-auto px-2 [scrollbar-width:none] sm:px-3', className)}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cx(
              'relative flex h-12 shrink-0 items-center rounded-xl px-3 font-display text-[15px] font-bold tracking-tight transition-colors duration-150',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            <span className="relative">
              {active && (
                <motion.span
                  layoutId={`tab-mark-${id}`}
                  aria-hidden
                  className="absolute -inset-x-1 bottom-[var(--tab-mark-bottom)] h-[var(--tab-mark-h)] -skew-x-6 rounded-[3px] bg-accent"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <span className={cx('relative transition-colors', active && '[color:var(--mark-ink)]')}>
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1.5 font-sans text-xs font-normal tabular-nums opacity-70">{tab.count}</span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
