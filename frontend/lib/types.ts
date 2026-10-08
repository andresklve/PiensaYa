export type Role = 'USUARIO' | 'ADMIN';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
}

export interface Me {
  userId: string;
  username: string;
  role: Role;
}

export interface Profile {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
}

export interface FollowerItem {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export type PostType = 'POST' | 'TWEET';

export type ReactionType =
  | 'LIKE'
  | 'DISLIKE'
  | 'FELIZ'
  | 'TRISTE'
  | 'ENOJADO'
  | 'INTERESANTE';

export const REACTIONS: { type: ReactionType; label: string }[] = [
  { type: 'LIKE', label: '👍 Like' },
  { type: 'DISLIKE', label: '👎 Dislike' },
  { type: 'FELIZ', label: '😀 Feliz' },
  { type: 'TRISTE', label: '😢 Triste' },
  { type: 'ENOJADO', label: '😠 Enojado' },
  { type: 'INTERESANTE', label: '🤔 Interesante' },
];

export interface Post {
  id: string;
  authorId: string;
  type: PostType;
  title?: string;
  content: string;
  commentsCount: number;
  reactions: Partial<Record<ReactionType, number>>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPosts {
  items: Post[];
  page: number;
  limit: number;
  total: number;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface FeedItem {
  postId: string;
  authorId: string;
  authorName?: string;
  authorUsername?: string;
  type: PostType;
  title?: string;
  excerpt: string;
  createdAt: string;
}

export interface FeedPage {
  items: FeedItem[];
  page: number;
  limit: number;
  total: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  otherUserId: string;
  lastMessage: Message;
  unreadCount: number;
}
