import { Suspense } from 'react';
import ConversationView from './conversation';

export default function ConversationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Cargando...</p>}>
      <ConversationView />
    </Suspense>
  );
}
