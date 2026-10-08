import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';
import { UsersClient } from './users.client';
import { PostCreatedEvent, PostDeletedEvent } from './events/post-events';
import { FeedItemDto, FeedPageDto } from './dto/feed.dto';

// feed:{userId}     -> lista de postIds, el más nuevo primero
// feedpost:{postId} -> snapshot JSON del post (una sola copia, compartida por todos los feeds)
export const feedKey = (userId: string) => `feed:${userId}`;
export const postKey = (postId: string) => `feedpost:${postId}`;

@Injectable()
export class FeedService {
  private readonly maxLength: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly usersClient: UsersClient,
    config: ConfigService,
  ) {
    this.maxLength = Number(config.get('FEED_MAX_LENGTH') ?? 500);
  }

  async fanOut(event: PostCreatedEvent): Promise<number> {
    const followerIds = await this.usersClient.getFollowerIds(event.authorId);
    const author = await this.usersClient.getAuthorInfo(event.authorId);

    const item: FeedItemDto = {
      postId: event.postId,
      authorId: event.authorId,
      authorName: author?.name,
      authorUsername: author?.username,
      type: event.type,
      title: event.title,
      excerpt: event.excerpt,
      createdAt: event.createdAt,
    };

    const recipients = [...new Set([event.authorId, ...followerIds])];

    const pipeline = this.redis.pipeline();
    pipeline.set(postKey(event.postId), JSON.stringify(item));
    for (const userId of recipients) {
      // LREM antes de LPUSH: si RabbitMQ re-entrega el evento, no se duplica.
      pipeline.lrem(feedKey(userId), 0, event.postId);
      pipeline.lpush(feedKey(userId), event.postId);
      pipeline.ltrim(feedKey(userId), 0, this.maxLength - 1);
    }
    await pipeline.exec();

    return recipients.length;
  }

  async removePost(event: PostDeletedEvent): Promise<void> {
    // Borrar el snapshot lo hace desaparecer de todos los feeds al instante;
    // las referencias huérfanas en cada lista se limpian al leer el feed.
    await this.redis.del(postKey(event.postId));
  }

  async getFeed(userId: string, page: number, limit: number): Promise<FeedPageDto> {
    const start = (page - 1) * limit;
    const [postIds, total] = await Promise.all([
      this.redis.lrange(feedKey(userId), start, start + limit - 1),
      this.redis.llen(feedKey(userId)),
    ]);

    if (postIds.length === 0) {
      return { items: [], page, limit, total };
    }

    const raw = await this.redis.mget(postIds.map(postKey));

    const items: FeedItemDto[] = [];
    const orphans: string[] = [];
    raw.forEach((value, i) => {
      if (value) items.push(JSON.parse(value) as FeedItemDto);
      else orphans.push(postIds[i]);
    });

    if (orphans.length > 0) {
      const cleanup = this.redis.pipeline();
      orphans.forEach((id) => cleanup.lrem(feedKey(userId), 0, id));
      await cleanup.exec();
    }

    return { items, page, limit, total: total - orphans.length };
  }
}
