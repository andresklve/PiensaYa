'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, Home, LogOut, MessageSquare, PenLine, Search, User, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { normalizeTag, useFollowing, useProfile } from '@/lib/queries';
import { Avatar, ButtonLink, TextLink, cx } from './ui';
import { ThemeToggle } from './theme-toggle';

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/feed', label: 'Inicio', icon: Home },
  { href: '/explorar', label: 'Explorar', icon: Compass },
  { href: '/chat', label: 'Mensajes', icon: MessageSquare },
  { href: '/perfil', label: 'Mi perfil', icon: User },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

// "piensa" + "Ya" subrayado con marcador.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('font-display text-[22px] font-extrabold leading-none tracking-[-0.03em]', className)}>
      piensa<span className="mark">Ya</span>
    </span>
  );
}

export function TopBar() {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    const tag = normalizeTag(q);
    // "#tema" abre el tema; cualquier otra cosa busca temas, personas y publicaciones.
    if (q.startsWith('#') && tag.length >= 2) router.push(`/explorar?tag=${encodeURIComponent(tag)}`);
    else router.push(`/explorar?q=${encodeURIComponent(q)}`);
    setQuery('');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-overlay backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-3 sm:gap-4 sm:px-5">
        <Link
          href={session ? '/feed' : '/'}
          aria-label="PiensaYa, inicio"
          className="flex h-11 shrink-0 items-center rounded-xl px-1.5 lg:w-[236px]"
        >
          <Logo />
        </Link>

        {pathname !== '/explorar' && (
          <form onSubmit={onSearch} role="search" className="hidden max-w-[440px] flex-1 md:block">
            <label className="group flex h-11 items-center gap-2.5 rounded-xl border border-transparent bg-surface px-3.5 transition-[border-color,background-color,box-shadow] focus-within:border-fg focus-within:bg-bg focus-within:shadow-[0_0_0_4px_var(--accent-soft)]">
              <Search size={18} className="shrink-0 text-fg-muted" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar temas, #hashtags o personas"
                aria-label="Buscar temas, hashtags o personas"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-muted"
              />
            </label>
          </form>
        )}

        <span className="flex-1" />

        {session ? (
          <>
            <Link
              href="/explorar"
              aria-label="Buscar"
              className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-surface md:hidden"
            >
              <Search size={20} aria-hidden />
            </Link>
            <ThemeToggle />
            <ButtonLink href="/feed#composer" variant="accent" className="w-11 !px-0 sm:w-auto sm:!px-4" aria-label="Escribir">
              <PenLine size={18} aria-hidden />
              <span className="hidden sm:inline">Escribir</span>
            </ButtonLink>
            <AccountMenu />
          </>
        ) : (
          <>
            <ThemeToggle />
            <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
              Iniciar sesión
            </ButtonLink>
            <ButtonLink href="/registro" variant="primary" size="sm">
              Crear cuenta
            </ButtonLink>
          </>
        )}
      </div>
    </header>
  );
}

function AccountMenu() {
  const { session, logout } = useAuth();
  const { data: me } = useProfile(session?.userId);
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

  if (!session) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Tu cuenta"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-surface"
      >
        <Avatar firstName={me?.firstName} lastName={me?.lastName} avatarUrl={me?.avatarUrl} size="xs" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{ originX: 1, originY: 0 }}
            className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-bg p-1.5 shadow-elevated"
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Avatar firstName={me?.firstName} lastName={me?.lastName} avatarUrl={me?.avatarUrl} size="sm" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-bold">{me ? `${me.firstName} ${me.lastName}` : session.username}</span>
                <span className="block truncate text-sm text-fg-muted">@{session.username}</span>
              </span>
            </div>
            <div className="my-1 border-t border-border" />
            <Link
              role="menuitem"
              href="/perfil"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors hover:bg-surface"
            >
              <User size={18} aria-hidden /> Mi perfil
            </Link>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-danger transition-colors hover:bg-danger-soft"
            >
              <LogOut size={18} aria-hidden /> Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Columna izquierda en escritorio: navegación + las personas que sigues.
export function IndexNav() {
  const isActive = useActive();
  return (
    <div className="flex h-full flex-col gap-7 overflow-y-auto py-5 pr-2 [scrollbar-width:thin]">
      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className="group relative flex h-11 items-center gap-3 rounded-xl px-3 font-bold"
            >
              {active && (
                <motion.span
                  layoutId="index-active"
                  className="absolute inset-0 rounded-xl bg-surface"
                  transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                />
              )}
              <span className="absolute inset-0 rounded-xl transition-colors group-hover:bg-surface" />
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} className="relative" aria-hidden />
              <span className={cx('relative', active ? 'mark' : 'mark-swipe-hover')}>{label}</span>
            </Link>
          );
        })}
      </nav>
      <FollowingIndex />
      <p className="mt-auto px-3 text-xs leading-relaxed text-fg-subtle">
        PiensaYa · proyecto de portafolio
        <br />
        Microservicios NestJS + Next.js
      </p>
    </div>
  );
}

function FollowingIndex() {
  const { session } = useAuth();
  // Misma clave que el botón Seguir: se actualiza al instante al seguir a alguien.
  const { data: people } = useFollowing(session?.userId);

  if (!session || !people) return null;

  return (
    <section aria-labelledby="index-following">
      <h2 id="index-following" className="mb-1.5 flex items-baseline justify-between px-3 text-xs font-bold uppercase tracking-[0.08em] text-fg-muted">
        Siguiendo
        <span className="font-normal tabular-nums">{people.length}</span>
      </h2>
      {people.length === 0 ? (
        <div className="paper-dots rounded-2xl px-3 py-4 text-sm text-fg-muted">
          Aún no sigues a nadie. <TextLink href="/explorar">Explora</TextLink> para armar tu cuaderno.
        </div>
      ) : (
        <ul className="flex flex-col">
          <AnimatePresence initial={false}>
          {people.slice(0, 8).map((p) => (
            <motion.li
              key={p.userId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <Link
                href={`/u/${p.username}`}
                className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-1.5 transition-colors hover:bg-surface"
              >
                <Avatar firstName={p.firstName} lastName={p.lastName} avatarUrl={p.avatarUrl} size="xs" />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-bold">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="block truncate text-xs text-fg-muted">@{p.username || '…'}</span>
                </span>
              </Link>
            </motion.li>
          ))}
          </AnimatePresence>
          {people.length > 8 && (
            <li className="px-3 pt-1 text-sm">
              <TextLink href="/perfil">Ver las {people.length}</TextLink>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function BottomNav() {
  const { session } = useAuth();
  const isActive = useActive();

  if (!session) return null;

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-overlay px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className="relative flex h-14 items-center justify-center"
          >
            <span className="relative flex h-10 w-14 items-center justify-center">
              {active && (
                <motion.span
                  layoutId="bottom-active"
                  className="absolute inset-0 rounded-xl bg-accent"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={cx('relative', active ? 'text-accent-ink' : 'text-fg')}
                aria-hidden
              />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
