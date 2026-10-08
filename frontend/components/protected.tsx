'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSession, Session } from '@/lib/session';
import { Spinner } from './ui';

export function Protected({
  children,
}: {
  children: (session: Session) => React.ReactNode;
}) {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Se lee del store, no del render, para no reaccionar al null de hidratación.
    if (!getSession()) router.replace('/login');
  }, [router]);

  if (!session) return <Spinner />;

  return <>{children(session)}</>;
}
