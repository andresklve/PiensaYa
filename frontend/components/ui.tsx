'use client';

import { ApiError } from '@/lib/api';

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded border border-gray-300 bg-white p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const styles = {
    primary: 'bg-black text-white hover:bg-gray-800',
    secondary: 'border border-gray-400 hover:bg-gray-100',
    danger: 'border border-red-400 text-red-700 hover:bg-red-50',
  }[variant];

  return (
    <button
      {...props}
      className={`rounded px-3 py-1.5 text-sm disabled:opacity-50 ${styles} ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-gray-300 px-3 py-2 text-sm ${props.className ?? ''}`}
    />
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`w-full rounded border border-gray-300 px-3 py-2 text-sm ${props.className ?? ''}`}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-gray-600">{children}</label>;
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof ApiError || error instanceof Error
      ? error.message
      : 'Ocurrió un error';
  return (
    <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
  );
}

export function Spinner({ label = 'Cargando...' }: { label?: string }) {
  return <p className="text-sm text-gray-500">{label}</p>;
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'hace unos segundos';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString('es-PE');
}
