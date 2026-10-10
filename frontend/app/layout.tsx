import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Providers } from './providers';
import { AppShell } from '@/components/app-shell';

// Bricolage para títulos y marca; Atkinson Hyperlegible (pensada para máxima
// legibilidad) para todo el texto de lectura e interfaz.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const body = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-atkinson',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PiensaYa',
  description: 'Apuntes y artículos de estudiantes, compartidos.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0a' },
  ],
};

// Fija data-theme antes del primer pintado (clave compartida con lib/theme.ts).
const THEME_INIT = `(function(){try{var t=localStorage.getItem('piensaya.theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <a
          href="#contenido"
          className="fixed left-4 top-4 z-50 -translate-y-20 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-ink transition-transform focus:translate-y-0"
        >
          Saltar al contenido
        </a>
        <Providers>
          <AuthProvider>
            <Suspense>
              <AppShell>{children}</AppShell>
            </Suspense>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
