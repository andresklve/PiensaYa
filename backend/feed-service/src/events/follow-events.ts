// Contrato de eventos publicado por el User & Follow Service (copia local).
export const USER_FOLLOWED = 'user_followed';
export const USER_UNFOLLOWED = 'user_unfollowed';

export interface FollowEvent {
  followerId: string;
  followingId: string;
  occurredAt: string;
}
