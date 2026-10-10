'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Highlighter, Lightbulb, MessageCircle } from 'lucide-react';
import { Logo } from './nav';
import { ThemeToggle } from './theme-toggle';

// Pantallas sin sesión: a la izquierda una hoja de cuaderno con una ficha y un
// apunte de muestra (decorativos); a la derecha el formulario.
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      <div className="paper-dots relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-12" aria-hidden>
        <Logo className="text-[28px]" />
        <div className="relative mx-auto w-full max-w-[460px] py-10">
          <motion.div
            initial={{ y: 24, opacity: 0, rotate: -3 }}
            animate={{ y: 0, opacity: 1, rotate: -2 }}
            transition={{ type: 'spring', stiffness: 160, damping: 20, delay: 0.1 }}
            className="rounded-2xl border border-border bg-bg p-6 shadow-elevated"
          >
            <div className="flex items-center gap-2 text-[13px] text-fg-muted">
              <span className="rounded-lg bg-surface px-2 py-0.5 text-xs font-bold text-fg">Artículo</span>
              8 min de lectura
            </div>
            <p className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight">
              La regla de la cadena no es magia: es <span className="mark">contabilidad de tasas</span>
            </p>
            <p className="mt-2 text-fg-muted">
              Si una cantidad depende de otra que también cambia, las tasas se multiplican.
            </p>
            <div className="mt-4 flex gap-4 text-sm text-fg-muted">
              <span className="flex items-center gap-1.5 font-bold text-fg">
                <Highlighter size={16} /> <span className="mark">Subrayado</span> 42
              </span>
              <span className="flex items-center gap-1.5">
                <Lightbulb size={16} /> 17
              </span>
              <span className="flex items-center gap-1.5">
                <MessageCircle size={16} /> 9
              </span>
            </div>
          </motion.div>
          <motion.div
            initial={{ y: 24, opacity: 0, rotate: 4 }}
            animate={{ y: 0, opacity: 1, rotate: 2.5 }}
            transition={{ type: 'spring', stiffness: 160, damping: 20, delay: 0.25 }}
            className="relative -mt-4 ml-auto w-[82%] rounded-2xl border border-border bg-bg p-5 shadow-elevated"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-fg-muted">Apunte · 3 h</span>
            <p className="mt-2 leading-relaxed">
              Si tu JOIN devuelve el doble de filas, revisa la cardinalidad antes de ponerle DISTINCT encima.
            </p>
          </motion.div>
        </div>
        <p className="text-sm text-fg-muted">Apuntes rápidos y artículos largos, escritos por estudiantes.</p>
      </div>

      <div className="relative flex flex-col justify-center px-6 py-14 sm:px-12">
        <ThemeToggle className="absolute right-4 top-4" />
        <Link href="/" className="mb-12 self-start rounded-xl lg:hidden" aria-label="PiensaYa, inicio">
          <Logo className="text-[28px]" />
        </Link>
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="w-full max-w-[400px]"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
