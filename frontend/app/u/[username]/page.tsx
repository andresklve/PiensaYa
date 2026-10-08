import { Suspense } from 'react';
import PublicProfile from './public-profile';

export default function PerfilPublicoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Cargando...</p>}>
      <PublicProfile />
    </Suspense>
  );
}
