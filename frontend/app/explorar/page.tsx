'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Post, Profile } from '@/lib/types';
import { Protected } from '@/components/protected';
import { Button, Card, ErrorText, Input, Spinner, timeAgo } from '@/components/ui';
import { Session } from '@/lib/session';

export default function ExplorarPage() {
  return <Protected>{(session) => <Explorar session={session} />}</Protected>;
}

function Explorar({ session }: { session: Session }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Profile | null>(null);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const loadFollowing = useCallback(async () => {
    const list = await api.users.following(session.userId);
    setFollowing(new Set(list.map((f) => f.userId)));
  }, [session.userId]);

  useEffect(() => {
    api.posts.list({ limit: 20 }).then((page) => setPosts(page.items));
    loadFollowing();
  }, [loadFollowing]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setSearchError(null);
    setFound(null);
    try {
      setFound(await api.users.byUsername(query.trim().toLowerCase()));
    } catch (e) {
      setSearchError(e);
    }
  }

  async function toggleFollow(userId: string) {
    if (following.has(userId)) {
      await api.users.unfollow(userId);
    } else {
      await api.users.follow(userId);
    }
    await loadFollowing();
    if (found) setFound(await api.users.byId(found.userId));
  }

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="font-bold">Buscar usuario</h1>
        <form onSubmit={search} className="mt-2 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="username exacto, ej. parrish"
            required
          />
          <Button type="submit">Buscar</Button>
        </form>
        <ErrorText error={searchError} />

        {found && (
          <div className="mt-3 border-t border-gray-200 pt-3 text-sm">
            <Link href={`/u/${found.username}`} className="font-semibold underline">
              {found.firstName} {found.lastName} · @{found.username}
            </Link>
            <p className="text-xs text-gray-500">
              {found.followersCount} seguidores · {found.followingCount} siguiendo
            </p>
            {found.userId !== session.userId && (
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => toggleFollow(found.userId)}
              >
                {following.has(found.userId) ? 'Dejar de seguir' : 'Seguir'}
              </Button>
            )}
          </div>
        )}
      </Card>

      <h2 className="font-bold">Publicaciones recientes de todos</h2>
      {!posts && <Spinner />}
      {posts?.map((post) => (
        <Card key={post.id}>
          <div className="flex items-baseline gap-2 text-xs text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{post.type}</span>
            <Link href={`/u/${post.authorId}`} className="underline">
              {post.authorId === session.userId ? 'tú' : post.authorId.slice(0, 8)}
            </Link>
            <span>{timeAgo(post.createdAt)}</span>
          </div>
          {post.title && <h3 className="mt-2 font-semibold">{post.title}</h3>}
          <p className="mt-1 whitespace-pre-wrap text-sm">{post.content}</p>
          <div className="mt-2 flex gap-3 text-xs text-gray-500">
            <span>{post.commentsCount} comentarios</span>
            <Link href={`/post/${post.id}`} className="underline">
              abrir
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}
