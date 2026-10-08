import { Suspense } from 'react';
import PostDetail from './post-detail';

export default function PostPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Cargando...</p>}>
      <PostDetail />
    </Suspense>
  );
}
