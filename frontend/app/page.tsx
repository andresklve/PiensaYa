'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, MessageSquare, NotebookPen } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AuthLayout } from '@/components/auth-layout';
import { ButtonLink, Spinner } from '@/components/ui';

const FEATURES = [
  { icon: NotebookPen, text: 'Apuntes rápidos de hasta 280 caracteres' },
  { icon: BookOpen, text: 'Artículos largos para explicar un tema a fondo' },
  { icon: MessageSquare, text: 'Mensajes en tiempo real con tus compañeros' },
];

export default function HomePage() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace('/feed');
  }, [session, router]);

  if (session) return <Spinner />;

  return (
    <AuthLayout>
      <h1 className="font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
        Lo que estudias, <span className="mark">compartido</span>.
      </h1>
      <p className="mt-4 text-lg text-fg-muted">
        Un cuaderno abierto entre estudiantes: subraya lo que te sirve y aprende de lo que otros explican.
      </p>

      <ul className="mt-8 space-y-3">
        {FEATURES.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-[15px]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface">
              <Icon size={18} aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/registro" variant="accent" size="lg" className="sm:flex-1">
          Crear cuenta
        </ButtonLink>
        <ButtonLink href="/login" variant="secondary" size="lg" className="sm:flex-1">
          Iniciar sesión
        </ButtonLink>
      </div>
    </AuthLayout>
  );
}
