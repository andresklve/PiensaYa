'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ApiError } from '@/lib/api';

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('rounded-2xl border border-border bg-bg p-4', className)}>
      {children}
    </div>
  );
}

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

// Esquinas de 12px en vez de píldoras: el lenguaje de fichas del cuaderno.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-fg text-bg hover:opacity-90',
  accent: 'bg-accent text-accent-ink hover:brightness-95',
  secondary: 'border border-border bg-bg text-fg hover:bg-surface',
  ghost: 'bg-transparent text-fg hover:bg-surface',
  danger: 'border border-danger/40 bg-transparent text-danger hover:bg-danger-soft',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm pointer-coarse:min-h-11',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-7 text-base',
};

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cx(
    'inline-flex select-none items-center justify-center gap-2 rounded-xl font-bold transition-[opacity,background-color,color,transform,filter] duration-150 ease-out active:scale-[0.97]',
    'disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

// Enlace de texto: se subraya con marcador al pasar el cursor.
export function TextLink({ className, children, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={cx('group font-bold text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-transparent', className)}>
      <span className="mark-swipe-hover">{children}</span>
    </Link>
  );
}

const fieldClass =
  'w-full rounded-xl border border-border bg-bg px-4 text-[15px] text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle hover:border-fg-subtle/70 focus:border-fg focus:shadow-[0_0_0_4px_var(--accent-soft)]';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, 'h-12', className)} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldClass, 'resize-y py-3 leading-relaxed', className)} />;
}

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-bold text-fg">
      {children}
      {hint && <span className="text-xs font-normal text-fg-muted">{hint}</span>}
    </label>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof ApiError || error instanceof Error ? error.message : 'Ocurrió un error';
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-fg">
      {children}
    </p>
  );
}

// Tres trazos de marcador que se pintan en secuencia.
export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <div role="status" className="flex justify-center py-12">
      <span className="flex items-end gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2.5 w-6 origin-left animate-[marker-stroke_1.1s_ease-in-out_infinite] rounded-[3px] bg-accent ring-1 ring-fg/10"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

const AVATAR_SIZES = {
  xs: 'h-8 w-8 rounded-[10px]',
  sm: 'h-10 w-10 rounded-xl',
  md: 'h-12 w-12 rounded-[14px]',
  xl: 'h-32 w-32 rounded-[28px]',
};

const INITIALS_SIZES = {
  xs: 'text-[10px] px-1 rounded-[5px]',
  sm: 'text-xs px-1 rounded-md',
  md: 'text-sm px-1.5 rounded-md',
  xl: 'text-3xl px-3 py-0.5 rounded-xl',
};

const PATTERNS = 6;

function hashSeed(seed: string): number {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

// Sin foto: un patrón propio de cada persona (puntos, rayas, cuadrícula…)
// derivado de su nombre, con las iniciales encima.
export function Avatar({
  firstName,
  lastName,
  avatarUrl,
  size = 'sm',
  className,
}: {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const base = cx('relative shrink-0 overflow-hidden', AVATAR_SIZES[size], className);
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del usuario
    return <img src={avatarUrl} alt="" className={cx(base, 'bg-surface object-cover')} />;
  }
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  const pattern = initials ? hashSeed(`${firstName}${lastName}`) % PATTERNS : 0;
  return (
    <span
      aria-hidden
      className={cx(base, `pattern-${pattern}`, 'flex items-center justify-center bg-surface text-dot')}
    >
      <span className={cx('bg-bg font-bold leading-snug tracking-wide text-fg', INITIALS_SIZES[size])}>
        {initials || '·'}
      </span>
    </span>
  );
}

// Encabezado fijo bajo la barra superior: título, volver y acciones.
export function PageHeader({
  title,
  subtitle,
  back,
  right,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: boolean;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-16 z-20 border-b border-border bg-overlay backdrop-blur-md">
      <div className="flex min-h-14 items-center gap-3 px-4 sm:px-5">
        {back && (
          <button
            onClick={() => router.back()}
            aria-label="Volver"
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-surface"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-extrabold leading-tight tracking-tight">{title}</h1>
          {subtitle && <div className="truncate text-xs text-fg-muted">{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </header>
  );
}

// Estado vacío como hoja punteada de cuaderno.
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('paper-dots m-4 rounded-2xl px-6 py-12 text-center sm:m-5', className)}>
      <p className="font-display text-xl font-extrabold tracking-tight">{title}</p>
      <p className="mx-auto mt-2 max-w-[38ch] text-[15px] text-fg-muted">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat('es-PE', { notation: 'compact' }).format(n);
}
