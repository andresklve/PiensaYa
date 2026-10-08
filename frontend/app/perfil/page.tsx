'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { FollowerItem, Me, Post, Profile } from '@/lib/types';
import { Protected } from '@/components/protected';
import { PostCard } from '@/components/post-card';
import {
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  Spinner,
  Textarea,
} from '@/components/ui';
import { Session } from '@/lib/session';

export default function PerfilPage() {
  return <Protected>{(session) => <Perfil session={session} />}</Protected>;
}

function Perfil({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [followers, setFollowers] = useState<FollowerItem[]>([]);
  const [followingList, setFollowingList] = useState<FollowerItem[]>([]);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      const [p, m, postsPage, f1, f2] = await Promise.all([
        api.users.me(),
        api.auth.me(),
        api.posts.list({ authorId: session.userId, limit: 30 }),
        api.users.followers(session.userId),
        api.users.following(session.userId),
      ]);
      setProfile(p);
      setMe(m);
      setPosts(postsPage.items);
      setFollowers(f1);
      setFollowingList(f2);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [session.userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorText error={error} />;
  if (!profile || !me) return <Spinner />;

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-lg font-bold">
          {profile.firstName} {profile.lastName}
        </h1>
        <p className="text-sm text-gray-600">
          @{profile.username} · rol {me.role}
        </p>
        {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
        <p className="mt-2 text-xs text-gray-500">
          {profile.followersCount} seguidores · {profile.followingCount} siguiendo
        </p>
      </Card>

      <EditProfile profile={profile} onSaved={setProfile} />
      <ChangePassword />

      <div className="grid gap-4 sm:grid-cols-2">
        <FollowList title="Seguidores" items={followers} />
        <FollowList title="Siguiendo" items={followingList} />
      </div>

      <h2 className="font-bold">Mis publicaciones</h2>
      {!posts && <Spinner />}
      {posts?.length === 0 && (
        <Card>
          <p className="text-sm text-gray-600">Todavía no has publicado nada.</p>
        </Card>
      )}
      {posts?.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          authorLabel={profile.username}
          currentUserId={session.userId}
          onDeleted={(id) => setPosts((prev) => (prev ?? []).filter((p) => p.id !== id))}
        />
      ))}
    </div>
  );
}

function FollowList({ title, items }: { title: string; items: FollowerItem[] }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold">
        {title} ({items.length})
      </h3>
      <ul className="mt-2 space-y-1 text-sm">
        {items.length === 0 && <li className="text-xs text-gray-500">Nadie aún.</li>}
        {items.map((item) => (
          <li key={item.userId}>
            <Link href={`/u/${item.username}`} className="underline">
              {item.firstName} {item.lastName} · @{item.username}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EditProfile({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (p: Profile) => void;
}) {
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    bio: profile.bio ?? '',
    avatarUrl: profile.avatarUrl ?? '',
  });
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      onSaved(
        await api.users.updateMe({
          firstName: form.firstName,
          lastName: form.lastName,
          bio: form.bio || undefined,
          avatarUrl: form.avatarUrl || undefined,
        }),
      );
      setSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold">Editar perfil</h3>
      <form onSubmit={onSubmit} className="mt-2 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label>Nombre</Label>
            <Input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Label>Apellido</Label>
            <Input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Bio (máx. 280)</Label>
          <Textarea
            rows={2}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>
        <div>
          <Label>URL de avatar</Label>
          <Input
            value={form.avatarUrl}
            onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <ErrorText error={error} />
        {saved && <p className="text-xs text-green-700">Perfil actualizado.</p>}
        <Button type="submit" disabled={busy}>
          Guardar
        </Button>
      </form>
    </Card>
  );
}

function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);
    setBusy(true);
    try {
      await api.auth.changePassword(form);
      setForm({ currentPassword: '', newPassword: '' });
      setDone(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold">Cambiar contraseña</h3>
      <form onSubmit={onSubmit} className="mt-2 space-y-2">
        <div>
          <Label>Contraseña actual</Label>
          <Input
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Nueva contraseña (mínimo 8)</Label>
          <Input
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            required
          />
        </div>
        <ErrorText error={error} />
        {done && (
          <p className="text-xs text-green-700">
            Contraseña actualizada. Tu sesión sigue activa hasta que expire el token.
          </p>
        )}
        <Button type="submit" disabled={busy}>
          Cambiar
        </Button>
      </form>
    </Card>
  );
}
