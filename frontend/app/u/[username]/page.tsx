import { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import PublicProfile from './public-profile';

export default function PerfilPublicoPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PublicProfile />
    </Suspense>
  );
}
