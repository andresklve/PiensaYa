import { clearSession, getSession, saveSession } from './session';
import {
  AuthResponse,
  Comment,
  CommentWithContext,
  Conversation,
  FeedPage,
  FollowerItem,
  ForYouItem,
  Me,
  SearchResult,
  TagCount,
  OwnPostActivity,
  Message,
  PaginatedPosts,
  Post,
  PostType,
  Profile,
  ReactionType,
} from './types';

export const SERVICES = {
  auth: process.env.NEXT_PUBLIC_AUTH_URL!,
  users: process.env.NEXT_PUBLIC_USERS_URL!,
  posts: process.env.NEXT_PUBLIC_POSTS_URL!,
  chat: process.env.NEXT_PUBLIC_CHAT_URL!,
  feed: process.env.NEXT_PUBLIC_FEED_URL!,
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<never> {
  let message = `Error ${res.status}`;
  try {
    const body = await res.json();
    const raw = body?.message ?? message;
    message = Array.isArray(raw) ? raw.join('. ') : String(raw);
  } catch {
    /* respuesta sin body JSON */
  }
  throw new ApiError(res.status, message);
}

export async function refreshTokens(): Promise<string | null> {
  const session = getSession();
  if (!session) return null;

  const res = await fetch(`${SERVICES.auth}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    return null;
  }

  return saveSession((await res.json()) as AuthResponse).accessToken;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  // 'optional': lectura pública que, con sesión, manda el token para recibir
  // datos propios (p. ej. tu reacción). Si la sesión ya no sirve, va como anónimo.
  auth?: boolean | 'optional';
  query?: Record<string, string | number | undefined>;
}

// Si el access token expiró (401), renueva con el refresh token y reintenta una vez.
async function request<T>(
  base: string,
  path: string,
  { method = 'GET', body, auth = true, query }: RequestOptions = {},
): Promise<T> {
  const url = new URL(`${base}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const send = (token?: string) =>
    fetch(url, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  const token = auth ? getSession()?.accessToken : undefined;
  let res = await send(token);

  if (res.status === 401 && (auth === true || token)) {
    const fresh = await refreshTokens();
    if (fresh) res = await send(fresh);
    else if (auth === 'optional') res = await send();
    else return parseError(res);
  }

  if (!res.ok) return parseError(res);

  // Varios endpoints responden 201/204 sin cuerpo (follow, logout, etc.).
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type ImageKind = 'avatar' | 'cover';

// fetch no informa progreso de subida; XMLHttpRequest sí. Si el token expiró
// se renueva y se reintenta una vez, igual que request().
function uploadImage(kind: ImageKind, file: Blob, onProgress?: (fraction: number) => void): Promise<Profile> {
  const send = (token?: string) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${SERVICES.users}/users/me/${kind}`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
      xhr.onerror = () => reject(new ApiError(0, 'No se pudo conectar con el servidor'));
      const form = new FormData();
      form.append('file', file, kind === 'avatar' ? 'avatar.jpg' : 'portada.jpg');
      xhr.send(form);
    });

  return (async () => {
    let res = await send(getSession()?.accessToken);
    if (res.status === 401) {
      const fresh = await refreshTokens();
      if (!fresh) throw new ApiError(401, 'Tu sesión expiró. Vuelve a iniciar sesión.');
      res = await send(fresh);
    }
    if (res.status === 413) throw new ApiError(413, 'La imagen no puede superar los 5 MB');
    let body: unknown;
    try {
      body = JSON.parse(res.body);
    } catch {
      body = null;
    }
    if (res.status < 200 || res.status >= 300) {
      const raw = (body as { message?: unknown } | null)?.message ?? `Error ${res.status}`;
      throw new ApiError(res.status, Array.isArray(raw) ? raw.join('. ') : String(raw));
    }
    return body as Profile;
  })();
}

export const api = {
  auth: {
    register: (body: {
      username: string;
      password: string;
      firstName: string;
      lastName: string;
    }) =>
      request<AuthResponse>(SERVICES.auth, '/auth/register', {
        method: 'POST',
        body,
        auth: false,
      }),
    login: (body: { username: string; password: string }) =>
      request<AuthResponse>(SERVICES.auth, '/auth/login', {
        method: 'POST',
        body,
        auth: false,
      }),
    me: () => request<Me>(SERVICES.auth, '/auth/me'),
    logout: () =>
      request<void>(SERVICES.auth, '/auth/logout', { method: 'POST' }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<void>(SERVICES.auth, '/auth/change-password', {
        method: 'PATCH',
        body,
      }),
  },

  users: {
    me: () => request<Profile>(SERVICES.users, '/users/me'),
    byId: (userId: string) =>
      request<Profile>(SERVICES.users, `/users/${userId}`, { auth: false }),
    byUsername: (username: string) =>
      request<Profile>(SERVICES.users, `/users/by-username/${username}`, {
        auth: false,
      }),
    updateMe: (body: { firstName?: string; lastName?: string; bio?: string }) =>
      request<Profile>(SERVICES.users, '/users/me', { method: 'PATCH', body }),
    uploadImage: (kind: ImageKind, file: Blob, onProgress?: (fraction: number) => void) =>
      uploadImage(kind, file, onProgress),
    removeImage: (kind: ImageKind) =>
      request<Profile>(SERVICES.users, `/users/me/${kind}`, { method: 'DELETE' }),
    follow: (userId: string) =>
      request<void>(SERVICES.users, `/users/${userId}/follow`, {
        method: 'POST',
      }),
    unfollow: (userId: string) =>
      request<void>(SERVICES.users, `/users/${userId}/follow`, {
        method: 'DELETE',
      }),
    search: (q: string, limit = 8) =>
      request<FollowerItem[]>(SERVICES.users, '/users/search', { auth: false, query: { q, limit } }),
    followers: (userId: string) =>
      request<FollowerItem[]>(SERVICES.users, `/users/${userId}/followers`, {
        auth: false,
      }),
    following: (userId: string) =>
      request<FollowerItem[]>(SERVICES.users, `/users/${userId}/following`, {
        auth: false,
      }),
  },

  posts: {
    create: (body: { type: PostType; title?: string; content: string }) =>
      request<Post>(SERVICES.posts, '/posts', { method: 'POST', body }),
    list: (query?: {
      authorId?: string;
      excludeAuthorId?: string;
      tag?: string;
      type?: PostType;
      page?: number;
      limit?: number;
    }) =>
      request<PaginatedPosts>(SERVICES.posts, '/posts', {
        auth: 'optional',
        query,
      }),
    byId: (id: string) =>
      request<Post>(SERVICES.posts, `/posts/${id}`, { auth: 'optional' }),
    batch: (ids: string[]) =>
      ids.length
        ? request<Post[]>(SERVICES.posts, '/posts/batch', { auth: 'optional', query: { ids: ids.join(',') } })
        : Promise.resolve([] as Post[]),
    search: (query: { q: string; excludeAuthorId?: string; type?: PostType; limit?: number }) =>
      request<SearchResult>(SERVICES.posts, '/posts/search', { auth: 'optional', query }),
    myActivity: () => request<OwnPostActivity[]>(SERVICES.posts, '/posts/activity/mine'),
    markSeen: (id: string) => request<void>(SERVICES.posts, `/posts/${id}/seen`, { method: 'POST' }),
    commentsByAuthor: (authorId: string, limit = 30) =>
      request<CommentWithContext[]>(SERVICES.posts, `/posts/comments/by-author/${authorId}`, {
        auth: false,
        query: { limit },
      }),
    update: (id: string, body: { title?: string; content?: string }) =>
      request<Post>(SERVICES.posts, `/posts/${id}`, { method: 'PATCH', body }),
    remove: (id: string) =>
      request<void>(SERVICES.posts, `/posts/${id}`, { method: 'DELETE' }),
    comments: (id: string) =>
      request<Comment[]>(SERVICES.posts, `/posts/${id}/comments`, {
        auth: false,
      }),
    addComment: (id: string, content: string) =>
      request<Comment>(SERVICES.posts, `/posts/${id}/comments`, {
        method: 'POST',
        body: { content },
      }),
    removeComment: (id: string, commentId: string) =>
      request<void>(SERVICES.posts, `/posts/${id}/comments/${commentId}`, {
        method: 'DELETE',
      }),
    react: (id: string, type: ReactionType) =>
      request<Post>(SERVICES.posts, `/posts/${id}/reactions`, {
        method: 'PUT',
        body: { type },
      }),
    removeReaction: (id: string) =>
      request<void>(SERVICES.posts, `/posts/${id}/reactions`, {
        method: 'DELETE',
      }),
  },

  hashtags: {
    suggest: (q: string, limit = 8) =>
      request<TagCount[]>(SERVICES.posts, '/hashtags/suggest', { auth: false, query: { q, limit } }),
  },

  feed: {
    mine: (query?: { page?: number; limit?: number }) =>
      request<FeedPage>(SERVICES.feed, '/feed', { query }),
    forYou: (query?: { type?: PostType; limit?: number }) =>
      request<{ items: ForYouItem[] }>(SERVICES.feed, '/feed/for-you', { query }),
  },

  chat: {
    conversations: () =>
      request<Conversation[]>(SERVICES.chat, '/chat/conversations'),
    history: (otherUserId: string, limit = 50) =>
      request<Message[]>(
        SERVICES.chat,
        `/chat/conversations/${otherUserId}/messages`,
        { query: { limit } },
      ),
    send: (otherUserId: string, content: string) =>
      request<Message>(
        SERVICES.chat,
        `/chat/conversations/${otherUserId}/messages`,
        { method: 'POST', body: { content } },
      ),
    markRead: (otherUserId: string) =>
      request<{ updated: number }>(
        SERVICES.chat,
        `/chat/conversations/${otherUserId}/read`,
        { method: 'PATCH' },
      ),
  },
};
