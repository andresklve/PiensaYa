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
  coverUrl: string | null;
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

// POST = artículo, TWEET = apunte (≤280), OPINION = opinión (≤600).
export type PostType = 'POST' | 'TWEET' | 'OPINION';

export const POST_LIMITS: Partial<Record<PostType, number>> = { TWEET: 280, OPINION: 600 };

export type ReactionType =
  | 'LIKE'
  | 'DISLIKE'
  | 'FELIZ'
  | 'TRISTE'
  | 'ENOJADO'
  | 'INTERESANTE';

export const REACTIONS: { type: ReactionType; label: string }[] = [
  { type: 'LIKE', label: 'Subrayar' },
  { type: 'INTERESANTE', label: 'Interesante' },
  { type: 'FELIZ', label: 'Me alegra' },
  { type: 'TRISTE', label: 'Me entristece' },
  { type: 'ENOJADO', label: 'Me molesta' },
  { type: 'DISLIKE', label: 'No me convence' },
];

export interface Post {
  id: string;
  authorId: string;
  type: PostType;
  title?: string;
  content: string;
  // Hashtags normalizados (sin #, minúsculas, sin tildes).
  tags?: string[];
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

export interface TagCount {
  tag: string;
  count: number;
}

export interface SearchResult {
  tags: TagCount[];
  posts: Post[];
}

// Publicación de "Para ti" con el motivo por el que aparece.
export type ForYouItem = Post & { reason: 'following' | 'discovery' };

// Publicación propia con comentarios/reacciones de otras personas sin ver.
export interface OwnPostActivity {
  post: Post;
  newComments: number;
  newReactions: number;
  lastActivityAt: string;
}

export interface CommentWithContext {
  comment: Comment;
  post: { id: string; authorId: string; type: PostType; title?: string; excerpt: string } | null;
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
