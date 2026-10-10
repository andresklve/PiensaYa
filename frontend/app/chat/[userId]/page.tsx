import { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import ConversationView from './conversation';

export default function ConversationPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ConversationView />
    </Suspense>
  );
}
