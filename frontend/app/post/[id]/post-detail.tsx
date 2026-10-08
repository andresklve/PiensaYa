'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Post, Profile } from '@/lib/types';
import { PostCard } from '@/components/post-card';
import { ErrorText, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function PostDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    (async () => {
      try {
        const found = await api.posts.byId(params.id);
        setPost(found);
        setAuthor(await api.users.byId(found.authorId).catch(() => null));
      } catch (e) {
        setError(e);
      }
    })();
  }, [params.id]);

  if (error) return <ErrorText error={error} />;
  if (!post) return <Spinner />;

  return (
    <PostCard
      post={post}
      authorLabel={author?.username}
      currentUserId={session?.userId ?? ''}
      onDeleted={() => router.push('/feed')}
    />
  );
}
