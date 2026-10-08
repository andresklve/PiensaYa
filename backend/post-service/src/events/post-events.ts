import { PostType } from '../schemas/post.schema';

export const FEED_CLIENT = 'FEED_CLIENT';

export const POST_CREATED = 'post_created';
export const POST_DELETED = 'post_deleted';

export interface PostCreatedEvent {
  postId: string;
  authorId: string;
  type: PostType;
  title?: string;
  excerpt: string;
  createdAt: string;
}

export interface PostDeletedEvent {
  postId: string;
  authorId: string;
}
