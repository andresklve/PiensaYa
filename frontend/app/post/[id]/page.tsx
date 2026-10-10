import { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import PostDetail from './post-detail';

export default function PostPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PostDetail />
    </Suspense>
  );
}
