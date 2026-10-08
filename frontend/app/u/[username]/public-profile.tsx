'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { FollowerItem, Post, Profile } from '@/lib/types';
import { PostCard } from '@/components/post-card';
import { Button, Card, ErrorText, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function PublicProfile() {
  const params = useParams<{ username: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [followers, setFollowers] = useState<FollowerItem[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      // La ruta acepta username o userId, para enlazar desde cualquier parte.
      const key = decodeURIComponent(params.username);
      const found = key.includes('-')
        ? await api.users.byId(key)
        : await api.users.byUsername(key);

      setProfile(found);
      const [postsPage, followerList] = await Promise.all([
        api.posts.list({ authorId: found.userId, limit: 30 }),
        api.users.followers(found.userId),
      ]);
      setPosts(postsPage.items);
      setFollowers(followerList);
      setIsFollowing(
        !!session && followerList.some((f) => f.userId === session.userId),
      );
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [params.username, session]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFollow() {
    if (!profile) return;
    setBusy(true);
    try {
      if (isFollowing) await api.users.unfollow(profile.userId);
      else await api.users.follow(profile.userId);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorText error={error} />;
  if (!profile) return <Spinner />;

  const isMe = session?.userId === profile.userId;

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-lg font-bold">
          {profile.firstName} {profile.lastName}
        </h1>
        <p className="text-sm text-gray-600">@{profile.username}</p>
        {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
        <p className="mt-2 text-xs text-gray-500">
          {profile.followersCount} seguidores · {profile.followingCount} siguiendo
        </p>

        <div className="mt-3 flex gap-2">
          {session && !isMe && (
            <>
              <Button variant="secondary" onClick={toggleFollow} disabled={busy}>
                {isFollowing ? 'Dejar de seguir' : 'Seguir'}
              </Button>
              <Link href={`/chat/${profile.userId}`}>
                <Button variant="secondary">Enviar mensaje</Button>
              </Link>
            </>
          )}
          {isMe && (
            <Link href="/perfil">
              <Button variant="secondary">Editar mi perfil</Button>
            </Link>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Seguidores ({followers.length})</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {followers.length === 0 && (
            <li className="text-xs text-gray-500">Nadie lo sigue aún.</li>
          )}
          {followers.map((f) => (
            <li key={f.userId}>
              <Link href={`/u/${f.username}`} className="underline">
                @{f.username}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="font-bold">Publicaciones</h2>
      {!posts && <Spinner />}
      {posts?.length === 0 && (
        <Card>
          <p className="text-sm text-gray-600">Sin publicaciones.</p>
        </Card>
      )}
      {posts?.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          authorLabel={profile.username}
          currentUserId={session?.userId ?? ''}
          onDeleted={(id) => setPosts((prev) => (prev ?? []).filter((p) => p.id !== id))}
        />
      ))}
    </div>
  );
}
