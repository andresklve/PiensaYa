'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CornerDownRight, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  useCommentsByAuthor,
  useFollowers,
  useFollowing,
  usePostList,
  useProfileByKey,
  useProfiles,
  useProfileImage,
  useUpdateProfile,
} from '@/lib/queries';
import { CommentWithContext, FollowerItem, Post, Profile } from '@/lib/types';
import { FollowButton } from './follow-button';
import { FilterChips, type Filter } from './filter-chips';
import { ImagePicker } from './image-picker';
import { RichText } from './rich-text';
import { Modal } from './modal';
import { PostCard } from './post-card';
import { Tabs } from './tabs';
import {
  Avatar,
  Button,
  ButtonLink,
  EmptyState,
  ErrorText,
  Input,
  Label,
  Notice,
  PageHeader,
  Spinner,
  Textarea,
  compactNumber,
  cx,
  timeAgo,
} from './ui';

type Tab = 'posts' | 'comments' | 'followers' | 'following';

// key: username o userId (las rutas antiguas enlazan por id).
export function ProfileView({ profileKey }: { profileKey: string }) {
  const { session } = useAuth();
  const { data: profile, error } = useProfileByKey(profileKey);
  const { data: postsPage } = usePostList({ authorId: profile?.userId, limit: 30 }, !!profile);
  const followers = useFollowers(profile?.userId);
  const following = useFollowing(profile?.userId);
  const comments = useCommentsByAuthor(profile?.userId);
  const [tab, setTab] = useState<Tab>('posts');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [editing, setEditing] = useState(false);

  if (error && !profile) {
    return (
      <>
        <PageHeader title="Perfil" back />
        <EmptyState title="Esta cuenta no existe" body="Prueba buscando otro nombre de usuario." />
      </>
    );
  }
  if (!profile) {
    return (
      <>
        <PageHeader title="Perfil" back />
        <Spinner />
      </>
    );
  }

  const isMe = session?.userId === profile.userId;
  const posts = postsPage?.items ?? null;
  const visible = posts?.filter((p) => filter === 'ALL' || p.type === filter) ?? null;

  return (
    <>
      <PageHeader
        title={`${profile.firstName} ${profile.lastName}`}
        subtitle={postsPage ? `${postsPage.total} ${postsPage.total === 1 ? 'publicación' : 'publicaciones'}` : undefined}
        back
      />

      <Cover profile={profile} editable={isMe} />

      <section className="px-4 pb-4 sm:px-5">
        <div className="flex items-start justify-between">
          <ProfileAvatar profile={profile} editable={isMe} />
          <div className="mt-3 flex items-center gap-2">
            {isMe ? (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Editar perfil
              </Button>
            ) : session ? (
              <>
                <ButtonLink href={`/chat/${profile.userId}`} variant="secondary" size="sm" aria-label="Enviar mensaje">
                  <MessageSquare size={16} aria-hidden />
                  <span className="hidden sm:inline">Mensaje</span>
                </ButtonLink>
                <FollowButton userId={profile.userId} />
              </>
            ) : (
              <ButtonLink href="/login" size="sm">
                Seguir
              </ButtonLink>
            )}
          </div>
        </div>

        <h2 className="mt-3 font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
          {profile.firstName} {profile.lastName}
        </h2>
        <p className="text-[15px] text-fg-muted">@{profile.username}</p>
        {profile.bio && <p className="mt-3 max-w-[60ch] whitespace-pre-wrap text-base leading-relaxed">{profile.bio}</p>}

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            { tab: 'following' as const, n: profile.followingCount, label: 'Siguiendo' },
            { tab: 'followers' as const, n: profile.followersCount, label: profile.followersCount === 1 ? 'Seguidor' : 'Seguidores' },
          ].map((s) => (
            <button
              key={s.tab}
              onClick={() => setTab(s.tab)}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-surface px-3 transition-colors hover:bg-surface-hover"
            >
              <strong className="font-display text-base tabular-nums">{compactNumber(s.n)}</strong>
              <span className="text-fg-muted">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="border-b border-border">
        <Tabs
          id="profile"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'posts', label: 'Publicaciones', count: postsPage?.total },
            { value: 'comments', label: 'Comentarios', count: comments.data?.length },
            { value: 'followers', label: 'Seguidores', count: profile.followersCount },
            { value: 'following', label: 'Siguiendo', count: profile.followingCount },
          ]}
        />
        {tab === 'posts' && <FilterChips id="profile" value={filter} onChange={setFilter} />}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {tab === 'posts' && (
            <PostList
              posts={visible}
              author={profile}
              currentUserId={session?.userId ?? ''}
              emptyTitle={filter === 'ALL' ? 'Aún no hay publicaciones' : 'Nada de este tipo todavía'}
            />
          )}
          {tab === 'comments' && <CommentList items={comments.data ?? null} author={profile} />}
          {(tab === 'followers' || tab === 'following') && (
            <PeopleList
              people={(tab === 'followers' ? followers : following).data ?? null}
              currentUserId={session?.userId}
              emptyTitle={tab === 'followers' ? 'Todavía sin seguidores' : 'Todavía no sigue a nadie'}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {isMe && (
        <Modal open={editing} onClose={() => setEditing(false)} title="Editar perfil">
          <EditImages profile={profile} />
          <div className="border-t border-border">
            <EditProfile profile={profile} />
          </div>
          <div className="border-t border-border">
            <ChangePassword />
          </div>
        </Modal>
      )}
    </>
  );
}

function Cover({ profile, editable }: { profile: Profile; editable: boolean }) {
  const image = profile.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- imagen del almacenamiento propio
    <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <div className="paper-dots h-full w-full" aria-hidden />
  );
  return (
    <div className="relative h-32 overflow-hidden sm:h-48">
      {image}
      {editable && (
        <ImagePicker kind="cover">
          {(open) => (
            <button
              onClick={open}
              className="absolute bottom-3 right-3 flex h-10 items-center gap-2 rounded-xl bg-fg/80 px-3 text-sm font-bold text-bg backdrop-blur-sm transition-colors hover:bg-fg pointer-coarse:h-11"
            >
              <Camera size={16} aria-hidden />
              {profile.coverUrl ? 'Cambiar portada' : 'Agregar portada'}
            </button>
          )}
        </ImagePicker>
      )}
    </div>
  );
}

function ProfileAvatar({ profile, editable }: { profile: Profile; editable: boolean }) {
  const avatar = (
    <Avatar
      firstName={profile.firstName}
      lastName={profile.lastName}
      avatarUrl={profile.avatarUrl}
      size="xl"
      className="!h-24 !w-24 ring-[5px] ring-bg sm:!h-32 sm:!w-32"
    />
  );
  if (!editable) return <div className="-mt-14 sm:-mt-16">{avatar}</div>;
  return (
    <div className="-mt-14 sm:-mt-16">
      <ImagePicker kind="avatar">
        {(open) => (
          <button onClick={open} aria-label="Cambiar foto de perfil" className="group relative block rounded-[28px]">
            {avatar}
            <span className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-fg/0 text-bg opacity-0 transition-[opacity,background-color] group-hover:bg-fg/45 group-hover:opacity-100 group-focus-visible:bg-fg/45 group-focus-visible:opacity-100">
              <Camera size={24} aria-hidden />
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-ink ring-4 ring-bg sm:hidden">
              <Camera size={16} aria-hidden />
            </span>
          </button>
        )}
      </ImagePicker>
    </div>
  );
}

function PostList({
  posts,
  author,
  currentUserId,
  emptyTitle,
}: {
  posts: Post[] | null;
  author: Profile;
  currentUserId: string;
  emptyTitle: string;
}) {
  if (!posts) return <Spinner />;
  if (posts.length === 0) {
    return <EmptyState title={emptyTitle} body="Cuando publique algo, aparecerá aquí." />;
  }
  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} author={author} currentUserId={currentUserId} />
      ))}
    </>
  );
}

const TYPE_NAME = { POST: 'artículo', TWEET: 'apunte', OPINION: 'opinión' } as const;

// Comentarios fuera de su hilo: cada uno muestra a qué publicación responde.
function CommentList({ items, author }: { items: CommentWithContext[] | null; author: Profile }) {
  const postAuthors = useProfiles(items?.flatMap((i) => (i.post ? [i.post.authorId] : [])) ?? []);
  if (!items) return <Spinner />;
  if (items.length === 0) {
    return <EmptyState title="Todavía sin comentarios" body="Cuando comente en alguna publicación, aparecerá aquí con su contexto." />;
  }
  return (
    <ul className="py-1">
      {items.map(({ comment, post }) => {
        const owner = post ? postAuthors[post.authorId] : null;
        return (
          <li key={comment.id} className="border-b border-dashed border-border px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <Avatar firstName={author.firstName} lastName={author.lastName} avatarUrl={author.avatarUrl} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg-muted">
                  <span className="font-bold text-fg">{author.firstName}</span> comentó
                  {post ? (
                    <>
                      {' '}
                      {post.type === 'OPINION' ? 'la' : 'el'} {TYPE_NAME[post.type]} de{' '}
                      <span className="font-bold text-fg">{owner ? `@${owner.username}` : '…'}</span>
                    </>
                  ) : (
                    ' una publicación que ya no existe'
                  )}{' '}
                  · {timeAgo(comment.createdAt)}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-base leading-relaxed"><RichText text={comment.content} />
                </p>
                {post && (
                  <Link
                    href={`/post/${post.id}#comentarios`}
                    className="group mt-3 flex gap-2 rounded-xl border border-border bg-surface/60 p-3 transition-colors hover:bg-surface"
                  >
                    <CornerDownRight size={16} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
                    <span className="min-w-0">
                      {post.title && (
                        <span className="block truncate font-display font-extrabold tracking-tight">{post.title}</span>
                      )}
                      <span className="line-clamp-2 text-sm text-fg-muted">{post.excerpt}</span>
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PeopleList({
  people,
  currentUserId,
  emptyTitle,
}: {
  people: FollowerItem[] | null;
  currentUserId?: string;
  emptyTitle: string;
}) {
  if (!people) return <Spinner />;
  if (people.length === 0) return <EmptyState title={emptyTitle} body="Las conexiones aparecerán aquí." />;
  return (
    <ul className="py-1">
      {people.map((p) => (
        <li key={p.userId} className="mx-2 flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface sm:mx-3">
          <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar firstName={p.firstName} lastName={p.lastName} avatarUrl={p.avatarUrl} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display font-extrabold tracking-tight hover:underline">
                {p.firstName} {p.lastName}
              </span>
              <span className="block truncate text-sm text-fg-muted">@{p.username}</span>
            </span>
          </Link>
          {currentUserId && p.userId !== currentUserId && <FollowButton userId={p.userId} />}
        </li>
      ))}
    </ul>
  );
}

// Foto de perfil y portada: se suben como archivo (no por URL).
function EditImages({ profile }: { profile: Profile }) {
  const avatar = useProfileImage('avatar');
  const cover = useProfileImage('cover');

  return (
    <section className="space-y-4 p-4 sm:p-5">
      <h3 className="font-display text-lg font-extrabold tracking-tight">Imágenes</h3>

      <div className="flex items-center gap-4">
        <Avatar firstName={profile.firstName} lastName={profile.lastName} avatarUrl={profile.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Foto de perfil</p>
          <p className="text-sm text-fg-muted">JPG, PNG o WebP. Se recorta en cuadrado.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <ImagePicker kind="avatar">
            {(open) => (
              <Button variant="secondary" size="sm" onClick={open}>
                {profile.avatarUrl ? 'Cambiar' : 'Subir'}
              </Button>
            )}
          </ImagePicker>
          {profile.avatarUrl && (
            <Button variant="ghost" size="sm" onClick={() => avatar.remove.mutate()} disabled={avatar.remove.isPending}>
              Quitar
            </Button>
          )}
        </div>
      </div>
      <ErrorText error={avatar.remove.error} />

      <div className="flex items-center gap-4">
        <div className={cx('h-12 w-24 shrink-0 overflow-hidden rounded-xl', !profile.coverUrl && 'paper-dots')}>
          {profile.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- imagen del almacenamiento propio
            <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Portada</p>
          <p className="text-sm text-fg-muted">Formato panorámico 3:1.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <ImagePicker kind="cover">
            {(open) => (
              <Button variant="secondary" size="sm" onClick={open}>
                {profile.coverUrl ? 'Cambiar' : 'Subir'}
              </Button>
            )}
          </ImagePicker>
          {profile.coverUrl && (
            <Button variant="ghost" size="sm" onClick={() => cover.remove.mutate()} disabled={cover.remove.isPending}>
              Quitar
            </Button>
          )}
        </div>
      </div>
      <ErrorText error={cover.remove.error} />
    </section>
  );
}

function EditProfile({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    bio: profile.bio ?? '',
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    update.mutate({ firstName: form.firstName, lastName: form.lastName, bio: form.bio || undefined });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-4 sm:p-5">
      <h3 className="font-display text-lg font-extrabold tracking-tight">Datos</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">Nombre</Label>
          <Input id="firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="lastName">Apellido</Label>
          <Input id="lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="bio" hint={`${form.bio.length}/280`}>
          Biografía
        </Label>
        <Textarea
          id="bio"
          rows={3}
          maxLength={280}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Qué estudias, qué te interesa, en qué puedes ayudar"
        />
      </div>
      <ErrorText error={update.error} />
      {update.isSuccess && <Notice>Perfil actualizado.</Notice>}
      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
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
    <form onSubmit={onSubmit} className="space-y-4 p-4 sm:p-5">
      <h3 className="font-display text-lg font-extrabold tracking-tight">Cambiar contraseña</h3>
      <div>
        <Label htmlFor="currentPassword">Contraseña actual</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="newPassword" hint="Mínimo 8 caracteres">
          Nueva contraseña
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          required
        />
      </div>
      <ErrorText error={error} />
      {done && <Notice>Contraseña actualizada. Tu sesión sigue activa hasta que expire el token.</Notice>}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? 'Cambiando…' : 'Cambiar contraseña'}
        </Button>
      </div>
    </form>
  );
}
