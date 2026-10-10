// Contrato de eventos publicado por el Post Service. Cada microservicio mantiene
// su propia copia: no se comparte código entre servicios, solo el contrato.
export const POST_CREATED = 'post_created';
export const POST_DELETED = 'post_deleted';

export interface PostCreatedEvent {
  postId: string;
  authorId: string;
  type: 'POST' | 'TWEET' | 'OPINION';
  title?: string;
  excerpt: string;
  createdAt: string;
}

export interface PostDeletedEvent {
  postId: string;
  authorId: string;
}
