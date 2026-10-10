// Contrato de eventos publicado por el User & Follow Service. El Feed Service
// mantiene su propia copia: no se comparte código entre servicios, solo el contrato.
export const FEED_CLIENT = 'FEED_CLIENT';

export const USER_FOLLOWED = 'user_followed';
export const USER_UNFOLLOWED = 'user_unfollowed';

export interface FollowEvent {
  followerId: string;
  followingId: string;
  occurredAt: string;
}
