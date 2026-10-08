'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Spinner } from '@/components/ui';

export default function HomePage() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace('/feed');
  }, [session, router]);

  if (session) return <Spinner />;

  return (
    <Card className="mt-8">
      <h1 className="text-xl font-bold">PiensaYa</h1>
      <p className="mt-2 text-sm text-gray-600">
        Publica artículos y tweets, sigue a otros estudiantes y conversa en
        tiempo real.
      </p>
      <div className="mt-4 flex gap-2">
        <Link href="/registro">
          <Button>Crear cuenta</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Ya tengo cuenta</Button>
        </Link>
      </div>
    </Card>
  );
}
