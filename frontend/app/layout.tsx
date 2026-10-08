import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Nav } from '@/components/nav';

export const metadata: Metadata = {
  title: 'PiensaYa',
  description: 'Plataforma social para estudiantes',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>
          <Suspense fallback={<div className="h-12 border-b border-gray-300 bg-white" />}>
            <Nav />
          </Suspense>
          <main className="mx-auto max-w-3xl p-4">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
