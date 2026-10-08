'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const LINKS = [
  { href: '/feed', label: 'Feed' },
  { href: '/explorar', label: 'Explorar' },
  { href: '/chat', label: 'Chat' },
  { href: '/perfil', label: 'Mi perfil' },
];

export function Nav() {
  const { session, logout } = useAuth();
  const pathname = usePathname();

  // La sesión vive en localStorage: el HTML prerenderizado no la conoce, así que
  // la barra se pinta vacía hasta montar para que la hidratación coincida.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <nav className="border-b border-gray-300 bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-4 p-3 text-sm">
        <Link href="/" className="font-bold">
          PiensaYa
        </Link>

        {!mounted ? null : session ? (
          <>
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname === link.href ? 'font-semibold underline' : 'text-gray-600'
                }
              >
                {link.label}
              </Link>
            ))}
            <span className="ml-auto text-gray-500">@{session.username}</span>
            <button onClick={logout} className="text-gray-600 underline">
              Salir
            </button>
          </>
        ) : (
          <div className="ml-auto flex gap-4">
            <Link href="/login" className="text-gray-600">
              Entrar
            </Link>
            <Link href="/registro" className="text-gray-600">
              Registrarse
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
