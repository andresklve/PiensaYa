'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const stack: symbol[] = [];

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = Symbol('modal');
    stack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    // Con modales anidados (recortar foto dentro de "Editar perfil") solo el
    // de arriba responde a Escape.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stack.at(-1) === id && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('input,textarea,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
      if (stack.length === 0) document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 backdrop-blur-[2px] sm:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="flex h-full w-full flex-col overflow-hidden bg-bg shadow-elevated sm:h-auto sm:max-h-[90vh] sm:max-w-[600px] sm:rounded-3xl sm:border sm:border-border"
          >
            <div className="flex h-16 shrink-0 items-center gap-4 border-b border-border px-4">
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-surface"
              >
                <X size={20} aria-hidden />
              </button>
              <h2 className="font-display text-xl font-extrabold tracking-tight">{title}</h2>
            </div>
            <div className="overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
