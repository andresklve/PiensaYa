import { clearSession, getSession, saveSession } from './session';
import {
  AuthResponse,
  Comment,
  Conversation,
  FeedPage,
  FollowerItem,
  Me,
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

async function refreshTokens(): Promise<string | null> {
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
  auth?: boolean;
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

  let res = await send(auth ? getSession()?.accessToken : undefined);

  if (res.status === 401 && auth) {
    const fresh = await refreshTokens();
    if (!fresh) return parseError(res);
    res = await send(fresh);
  }

  if (!res.ok) return parseError(res);

  // Varios endpoints responden 201/204 sin cuerpo (follow, logout, etc.).
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
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
    updateMe: (body: {
      firstName?: string;
      lastName?: string;
      bio?: string;
      avatarUrl?: string;
    }) => request<Profile>(SERVICES.users, '/users/me', { method: 'PATCH', body }),
    follow: (userId: string) =>
      request<void>(SERVICES.users, `/users/${userId}/follow`, {
        method: 'POST',
      }),
    unfollow: (userId: string) =>
      request<void>(SERVICES.users, `/users/${userId}/follow`, {
        method: 'DELETE',
      }),
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
    list: (query?: { authorId?: string; type?: PostType; page?: number; limit?: number }) =>
      request<PaginatedPosts>(SERVICES.posts, '/posts', {
        auth: false,
        query,
      }),
    byId: (id: string) =>
      request<Post>(SERVICES.posts, `/posts/${id}`, { auth: false }),
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

  feed: {
    mine: (query?: { page?: number; limit?: number }) =>
      request<FeedPage>(SERVICES.feed, '/feed', { query }),
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
