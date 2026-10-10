'use client';

import {
  QueryClient,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, ImageKind } from './api';
import { useAuth } from './auth-context';
import { setMyReaction } from './my-reactions';
import { getSession } from './session';
import {
  Comment,
  FollowerItem,
  ForYouItem,
  OwnPostActivity,
  PaginatedPosts,
  Post,
  PostType,
  Profile,
  ReactionType,
} from './types';

// ---------------------------------------------------------------------------
// Claves de caché. Todas las vistas leen de aquí; una mutación actualiza o
// invalida las claves afectadas y cada vista que las use se refresca sola.
// ---------------------------------------------------------------------------
export const qk = {
  profile: (userId: string) => ['profile', userId] as const,
  profileByUsername: (username: string) => ['profile-username', username] as const,
  following: (userId: string) => ['following', userId] as const,
  followers: (userId: string) => ['followers', userId] as const,
  posts: (params: { authorId?: string; excludeAuthorId?: string; tag?: string; type?: PostType; limit?: number }) =>
    ['posts', params] as const,
  tagSuggestions: (q: string) => ['hashtags', q] as const,
  search: (q: string, type?: PostType) => ['search', q, type ?? 'ALL'] as const,
  userSearch: (q: string) => ['user-search', q] as const,
  post: (id: string) => ['post', id] as const,
  followingFeed: () => ['feed', 'following'] as const,
  forYou: (type?: PostType) => ['feed', 'for-you', type ?? 'ALL'] as const,
  ownActivity: () => ['activity'] as const,
  commentsByAuthor: (authorId: string) => ['author-comments', authorId] as const,
  comments: (postId: string) => ['comments', postId] as const,
  conversations: () => ['conversations'] as const,
};

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Perfiles
// ---------------------------------------------------------------------------
const loadProfile = (userId: string) => api.users.byId(userId).catch(() => null);

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: qk.profile(userId ?? ''),
    queryFn: () => loadProfile(userId!),
    enabled: !!userId,
  });
}

// Varios perfiles a la vez (autores de un feed, participantes de chats…).
export function useProfiles(userIds: string[]): Record<string, Profile | null> {
  const ids = [...new Set(userIds)].filter(Boolean);
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: qk.profile(id),
      queryFn: () => loadProfile(id),
      staleTime: 60_000,
    })),
    combine: (results) =>
      Object.fromEntries(ids.flatMap((id, i) => (results[i].data !== undefined ? [[id, results[i].data]] : []))) as Record<
        string,
        Profile | null
      >,
  });
}

// Acepta username o userId (las rutas antiguas enlazan por id).
export function useProfileByKey(key: string) {
  const byId = key.includes('-');
  return useQuery({
    queryKey: byId ? qk.profile(key) : qk.profileByUsername(key.toLowerCase()),
    queryFn: () => (byId ? api.users.byId(key) : api.users.byUsername(key.toLowerCase())),
    retry: false,
  });
}

export function displayName(profile: Profile | null | undefined, fallbackId: string): string {
  return profile ? `${profile.firstName} ${profile.lastName}` : fallbackId.slice(0, 8);
}

// Aplica un cambio a un perfil en todas las claves donde esté guardado.
function patchProfile(qc: QueryClient, userId: string, patch: (p: Profile) => Profile) {
  qc.setQueriesData<Profile | null>(
    { predicate: (q) => q.queryKey[0] === 'profile' || q.queryKey[0] === 'profile-username' },
    (old) => (old && old.userId === userId ? patch(old) : old),
  );
}

function storeProfile(qc: QueryClient, profile: Profile) {
  qc.setQueryData(qk.profile(profile.userId), profile);
  qc.setQueryData(qk.profileByUsername(profile.username), profile);
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.users.updateMe,
    onSuccess: (profile) => storeProfile(qc, profile),
  });
}

export function useProfileImage(kind: ImageKind) {
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: ({ file, onProgress }: { file: Blob; onProgress?: (f: number) => void }) =>
      api.users.uploadImage(kind, file, onProgress),
    onSuccess: (profile) => {
      storeProfile(qc, profile);
      // Las listas de seguidores/siguiendo también muestran el avatar.
      void qc.invalidateQueries({ queryKey: ['following'] });
      void qc.invalidateQueries({ queryKey: ['followers'] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.users.removeImage(kind),
    onSuccess: (profile) => storeProfile(qc, profile),
  });
  return { upload, remove };
}

// ---------------------------------------------------------------------------
// Seguir / dejar de seguir
// ---------------------------------------------------------------------------
export function useFollowing(userId: string | undefined) {
  return useQuery({
    queryKey: qk.following(userId ?? ''),
    queryFn: () => api.users.following(userId!),
    enabled: !!userId,
  });
}

export function useFollowers(userId: string | undefined) {
  return useQuery({
    queryKey: qk.followers(userId ?? ''),
    queryFn: () => api.users.followers(userId!),
    enabled: !!userId,
  });
}

// ¿Sigo a esta persona? undefined mientras no se sabe.
export function useIsFollowing(userId: string): boolean | undefined {
  const { session } = useAuth();
  const { data } = useFollowing(session?.userId);
  return data ? data.some((f) => f.userId === userId) : undefined;
}

// Una sola fuente de verdad: la lista de a quién sigo. El cambio es optimista
// (botón, panel de sugerencias, índice y contadores cambian al instante) y si
// el servidor falla se revierte todo.
export function useFollowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) =>
      follow ? api.users.follow(userId) : api.users.unfollow(userId),
    onMutate: async ({ userId, follow }) => {
      const me = getSession()?.userId;
      if (!me) return;
      await qc.cancelQueries({ queryKey: qk.following(me) });
      const previous = qc.getQueryData<FollowerItem[]>(qk.following(me));
      const target = qc.getQueryData<Profile | null>(qk.profile(userId));

      qc.setQueryData<FollowerItem[]>(qk.following(me), (old = []) =>
        follow
          ? old.some((f) => f.userId === userId)
            ? old
            : [
                ...old,
                {
                  userId,
                  username: target?.username ?? '',
                  firstName: target?.firstName ?? '',
                  lastName: target?.lastName ?? '',
                  avatarUrl: target?.avatarUrl ?? null,
                },
              ]
          : old.filter((f) => f.userId !== userId),
      );
      const delta = follow ? 1 : -1;
      patchProfile(qc, userId, (p) => ({ ...p, followersCount: Math.max(0, p.followersCount + delta) }));
      patchProfile(qc, me, (p) => ({ ...p, followingCount: Math.max(0, p.followingCount + delta) }));
      return { me, previous, delta };
    },
    onError: (_error, { userId }, ctx) => {
      if (!ctx?.me) return;
      qc.setQueryData(qk.following(ctx.me), ctx.previous);
      patchProfile(qc, userId, (p) => ({ ...p, followersCount: p.followersCount - ctx.delta }));
      patchProfile(qc, ctx.me, (p) => ({ ...p, followingCount: p.followingCount - ctx.delta }));
    },
    onSettled: (_data, _error, { userId }) => {
      const me = getSession()?.userId;
      if (me) {
        void qc.invalidateQueries({ queryKey: qk.following(me) });
        void qc.invalidateQueries({ queryKey: qk.profile(me) });
      }
      void qc.invalidateQueries({ queryKey: qk.followers(userId) });
      void qc.invalidateQueries({ queryKey: qk.profile(userId) });
      void qc.invalidateQueries({ queryKey: ['profile-username'] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Publicaciones
// ---------------------------------------------------------------------------
export function usePostList(
  params: { authorId?: string; excludeAuthorId?: string; tag?: string; type?: PostType; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: qk.posts(params),
    queryFn: () => api.posts.list(params),
    enabled,
  });
}

export function usePost(id: string) {
  return useQuery({ queryKey: qk.post(id), queryFn: () => api.posts.byId(id), retry: false });
}

// "Siguiendo": el Feed Service guarda un extracto por post (fan-out en Redis);
// se completa con el post del Post Service para tener reacciones y conteos.
export function useFollowingFeed(enabled: boolean) {
  return useQuery({
    queryKey: qk.followingFeed(),
    queryFn: async () => {
      const page = await api.feed.mine({ limit: 30 });
      return api.posts.batch(page.items.map((i) => i.postId));
    },
    enabled,
    // El feed se llena por consistencia eventual: se revisa cada tanto.
    refetchInterval: 30_000,
  });
}

// "Para ti" (Feed Service): 3 de seguidos por 1 de descubrimiento, sin lo propio.
export function useForYou(type: PostType | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.forYou(type),
    queryFn: async (): Promise<ForYouItem[]> => (await api.feed.forYou({ type, limit: 30 })).items,
    enabled,
  });
}

// Publicaciones propias con actividad nueva de otras personas. Se pide al
// montar la vista; no se refresca al volver a la pestaña para que una tarjeta
// que estás leyendo no desaparezca de golpe al marcarse como vista.
export function useOwnActivity(enabled: boolean) {
  return useQuery({
    queryKey: qk.ownActivity(),
    queryFn: api.posts.myActivity,
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Hashtags y búsqueda
// ---------------------------------------------------------------------------

// Igual que en el Post Service: minúsculas y sin tildes.
export function normalizeTag(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

export function useTagSuggestions(q: string | null) {
  const key = q === null ? '' : normalizeTag(q);
  return useQuery({
    queryKey: qk.tagSuggestions(key),
    queryFn: () => api.hashtags.suggest(key),
    enabled: q !== null,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

export function useSearch(q: string, type: PostType | undefined, excludeAuthorId: string | undefined) {
  const term = q.trim();
  return useQuery({
    queryKey: qk.search(term, type),
    queryFn: () => api.posts.search({ q: term, type, excludeAuthorId, limit: 30 }),
    enabled: term.replace(/^#/, '').length >= 2,
    placeholderData: (previous) => previous,
  });
}

export function useUserSearch(q: string) {
  const term = q.trim().replace(/^@/, '');
  return useQuery({
    queryKey: qk.userSearch(term.toLowerCase()),
    queryFn: () => api.users.search(term),
    enabled: term.length >= 2,
    placeholderData: (previous) => previous,
  });
}

export function useMarkSeen() {
  return useMutation({ mutationFn: (postId: string) => api.posts.markSeen(postId) });
}

export function useCommentsByAuthor(authorId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.commentsByAuthor(authorId ?? ''),
    queryFn: () => api.posts.commentsByAuthor(authorId!),
    enabled: !!authorId && enabled,
  });
}

type PostCache = PaginatedPosts | Post[] | OwnPostActivity[] | Post | undefined;

// Aplica un cambio a una publicación en todas las listas y en su detalle.
export function patchPost(qc: QueryClient, postId: string, patch: (p: Post) => Post) {
  qc.setQueriesData<PostCache>(
    { predicate: (q) => ['posts', 'feed', 'post', 'activity'].includes(q.queryKey[0] as string) },
    (old) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return old.map((x) => {
          if ('post' in x) return x.post.id === postId ? { ...x, post: patch(x.post) } : x;
          return x.id === postId ? { ...x, ...patch(x) } : x;
        }) as PostCache;
      }
      if ('items' in old) return { ...old, items: old.items.map((p) => (p.id === postId ? patch(p) : p)) };
      return old.id === postId ? patch(old) : old;
    },
  );
}

function dropPost(qc: QueryClient, postId: string) {
  qc.setQueriesData<PostCache>({ predicate: (q) => ['posts', 'feed', 'activity'].includes(q.queryKey[0] as string) }, (old) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return old.filter((x) => ('post' in x ? x.post.id !== postId : x.id !== postId)) as PostCache;
    }
    if ('items' in old) return { ...old, items: old.items.filter((p) => p.id !== postId), total: Math.max(0, old.total - 1) };
    return old;
  });
  qc.removeQueries({ queryKey: qk.post(postId) });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.posts.create,
    onSuccess: (post) => {
      // Aparece al instante arriba de las listas que la incluirían…
      for (const query of qc.getQueryCache().findAll({ queryKey: ['posts'] })) {
        const params = query.queryKey[1] as { authorId?: string; excludeAuthorId?: string; tag?: string; type?: PostType };
        if (
          (params.authorId && params.authorId !== post.authorId) ||
          params.excludeAuthorId === post.authorId ||
          (params.tag && !post.tags?.includes(params.tag)) ||
          (params.type && params.type !== post.type)
        ) {
          continue;
        }
        qc.setQueryData<PaginatedPosts>(query.queryKey, (old) =>
          old ? { ...old, items: [post, ...old.items.filter((p) => p.id !== post.id)], total: old.total + 1 } : old,
        );
      }
      qc.setQueryData<Post[]>(qk.followingFeed(), (old) => (old ? [post, ...old] : old));
      // …y luego se reconcilia con el servidor (los hashtags nuevos ya se sugieren).
      void qc.invalidateQueries({ queryKey: ['hashtags'] });
      void qc.invalidateQueries({ queryKey: ['search'] });
      void qc.invalidateQueries({ queryKey: ['posts'] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.posts.remove(postId),
    onSuccess: (_d, postId) => {
      dropPost(qc, postId);
      void qc.invalidateQueries({ queryKey: ['posts'] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

// Optimista: el conteo cambia al instante en todas las vistas del post y se
// reconcilia con la respuesta; si falla, se revierte.
export function useReactMutation(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ post, type, mine }: { post: Post; type: ReactionType; mine: ReactionType | null }) => {
      if (mine === type) {
        await api.posts.removeReaction(post.id);
        return api.posts.byId(post.id);
      }
      return api.posts.react(post.id, type);
    },
    onMutate: ({ post, type, mine }) => {
      const removing = mine === type;
      const counts = { ...post.reactions };
      if (mine) counts[mine] = Math.max(0, (counts[mine] ?? 1) - 1);
      if (!removing) counts[type] = (counts[type] ?? 0) + 1;
      setMyReaction(userId, post.id, removing ? null : type);
      patchPost(qc, post.id, (p) => ({ ...p, reactions: counts }));
      return { snapshot: post, mine };
    },
    onError: (_e, { post }, ctx) => {
      if (!ctx) return;
      setMyReaction(userId, post.id, ctx.mine);
      patchPost(qc, post.id, () => ctx.snapshot);
    },
    onSuccess: (fresh) => patchPost(qc, fresh.id, (p) => ({ ...p, reactions: fresh.reactions })),
  });
}

// ---------------------------------------------------------------------------
// Comentarios
// ---------------------------------------------------------------------------
export function useComments(postId: string) {
  return useQuery({ queryKey: qk.comments(postId), queryFn: () => api.posts.comments(postId) });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.posts.addComment(postId, content),
    onSuccess: (comment) => {
      qc.setQueryData<Comment[]>(qk.comments(postId), (old = []) => [...old, comment]);
      patchPost(qc, postId, (p) => ({ ...p, commentsCount: p.commentsCount + 1 }));
      void qc.invalidateQueries({ queryKey: qk.commentsByAuthor(comment.authorId) });
    },
  });
}

export function useRemoveComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.posts.removeComment(postId, commentId),
    onSuccess: (_d, commentId) => {
      qc.setQueryData<Comment[]>(qk.comments(postId), (old = []) => old.filter((c) => c.id !== commentId));
      patchPost(qc, postId, (p) => ({ ...p, commentsCount: Math.max(0, p.commentsCount - 1) }));
      void qc.invalidateQueries({ queryKey: ['author-comments'] });
    },
  });
}
