import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { FeedService } from './feed.service';
import { POST_CREATED, POST_DELETED } from './events/post-events';
import type { PostCreatedEvent, PostDeletedEvent } from './events/post-events';
import { USER_FOLLOWED, USER_UNFOLLOWED } from './events/follow-events';
import type { FollowEvent } from './events/follow-events';

const RETRY_DELAY_MS = 3000;

@Controller()
export class FeedEventsController {
  private readonly logger = new Logger(FeedEventsController.name);

  constructor(private readonly feedService: FeedService) {}

  @EventPattern(POST_CREATED)
  async onPostCreated(
    @Payload() event: PostCreatedEvent,
    @Ctx() ctx: RmqContext,
  ): Promise<void> {
    if (!event?.postId || !event?.authorId) {
      this.logger.error(`Evento ${POST_CREATED} malformado, se descarta`);
      return this.ack(ctx);
    }

    try {
      const recipients = await this.feedService.fanOut(event);
      this.logger.log(`Post ${event.postId} distribuido a ${recipients} feeds`);
      this.ack(ctx);
    } catch (error) {
      this.retryLater(ctx, POST_CREATED, error);
    }
  }

  @EventPattern(POST_DELETED)
  async onPostDeleted(
    @Payload() event: PostDeletedEvent,
    @Ctx() ctx: RmqContext,
  ): Promise<void> {
    if (!event?.postId) {
      this.logger.error(`Evento ${POST_DELETED} malformado, se descarta`);
      return this.ack(ctx);
    }

    try {
      await this.feedService.removePost(event);
      this.logger.log(`Post ${event.postId} retirado de los feeds`);
      this.ack(ctx);
    } catch (error) {
      this.retryLater(ctx, POST_DELETED, error);
    }
  }

  @EventPattern(USER_FOLLOWED)
  async onUserFollowed(@Payload() event: FollowEvent, @Ctx() ctx: RmqContext): Promise<void> {
    if (!event?.followerId || !event?.followingId) {
      this.logger.error(`Evento ${USER_FOLLOWED} malformado, se descarta`);
      return this.ack(ctx);
    }
    try {
      const added = await this.feedService.backfill(event);
      this.logger.log(`${added} publicaciones de ${event.followingId} agregadas al feed de ${event.followerId}`);
      this.ack(ctx);
    } catch (error) {
      this.retryLater(ctx, USER_FOLLOWED, error);
    }
  }

  @EventPattern(USER_UNFOLLOWED)
  async onUserUnfollowed(@Payload() event: FollowEvent, @Ctx() ctx: RmqContext): Promise<void> {
    if (!event?.followerId || !event?.followingId) {
      this.logger.error(`Evento ${USER_UNFOLLOWED} malformado, se descarta`);
      return this.ack(ctx);
    }
    try {
      await this.feedService.purge(event);
      this.logger.log(`Publicaciones de ${event.followingId} retiradas del feed de ${event.followerId}`);
      this.ack(ctx);
    } catch (error) {
      this.retryLater(ctx, USER_UNFOLLOWED, error);
    }
  }

  private ack(ctx: RmqContext): void {
    ctx.getChannelRef().ack(ctx.getMessage());
  }

  // Si falla (p. ej. User Service caído), el mensaje vuelve a la cola y se
  // reintenta: el post nunca se pierde, el feed queda eventualmente consistente.
  private retryLater(ctx: RmqContext, pattern: string, error: unknown): void {
    this.logger.warn(
      `Fallo procesando ${pattern}, se reintentará en ${RETRY_DELAY_MS}ms: ${
        (error as Error)?.message ?? error
      }`,
    );
    setTimeout(
      () => ctx.getChannelRef().nack(ctx.getMessage(), false, true),
      RETRY_DELAY_MS,
    );
  }
}
