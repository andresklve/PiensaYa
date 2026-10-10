import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';
import { UsersClient } from './users.client';
import { PostKind, PostsClient, PostView } from './posts.client';
import { PostCreatedEvent, PostDeletedEvent } from './events/post-events';
import { FollowEvent } from './events/follow-events';
import { FeedItemDto, FeedPageDto, ForYouDto, ForYouItemDto } from './dto/feed.dto';

// Al seguir a alguien se traen sus últimas publicaciones a tu feed.
const BACKFILL_LIMIT = 20;
// "Para ti": de cada 4 publicaciones, 3 son de gente que sigues y 1 de descubrimiento.
const FOLLOWING_PER_DISCOVERY = 3;
const DISCOVERY_POOL = 50;
const EXCERPT_LENGTH = 200;
const MERGE_RETRIES = 5;
const SYNC_MAX_FOLLOWING = 100;

// feed:{userId}     -> lista de postIds, el más nuevo primero
// feedpost:{postId} -> snapshot JSON del post (una sola copia, compartida por todos los feeds)
export const feedKey = (userId: string) => `feed:${userId}`;
export const postKey = (postId: string) => `feedpost:${postId}`;
// Marca de que el feed ya incluye lo anterior de todas las personas seguidas.
export const syncedKey = (userId: string) => `feedsync:v1:${userId}`;

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);
  private readonly maxLength: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly usersClient: UsersClient,
    private readonly postsClient: PostsClient,
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
    await this.ensureSynced(userId);
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

  // ---------------------------------------------------------------------------
  // Seguir / dejar de seguir: el fan-out solo reparte publicaciones NUEVAS, así
  // que al seguir a alguien se traen sus últimas publicaciones al feed.
  // ---------------------------------------------------------------------------
  async backfill(event: FollowEvent): Promise<number> {
    const [posts, author] = await Promise.all([
      this.postsClient.list({ authorId: event.followingId, limit: BACKFILL_LIMIT }),
      this.usersClient.getAuthorInfo(event.followingId),
    ]);
    if (posts.length === 0) return 0;

    const items: FeedItemDto[] = posts.map((p) => ({
      postId: p.id,
      authorId: p.authorId,
      authorName: author?.name,
      authorUsername: author?.username,
      type: p.type,
      title: p.title,
      excerpt: p.content.slice(0, EXCERPT_LENGTH),
      createdAt: p.createdAt,
    }));

    // Snapshot compartido (SET NX: si ya existe por otro seguidor, se reutiliza).
    const snapshots = this.redis.pipeline();
    for (const item of items) snapshots.set(postKey(item.postId), JSON.stringify(item), 'NX');
    await snapshots.exec();

    await this.rewriteFeed(event.followerId, (entries) => [
      ...entries,
      ...items.map((i) => ({ postId: i.postId, authorId: i.authorId, createdAt: i.createdAt })),
    ]);
    return items.length;
  }

  // Los follows creados antes de existir el backfill nunca trajeron lo
  // anterior. La primera vez que se pide un feed se completa con todas las
  // personas seguidas; después lo mantienen los eventos user_followed.
  async ensureSynced(userId: string): Promise<void> {
    // SET NX: solo una petición hace la sincronización aunque lleguen varias a la vez.
    const claimed = await this.redis.set(syncedKey(userId), new Date().toISOString(), 'NX');
    if (claimed !== 'OK') return;
    try {
      const following = (await this.usersClient.getFollowingIds(userId)).slice(0, SYNC_MAX_FOLLOWING);
      for (const followingId of following) {
        await this.backfill({ followerId: userId, followingId, occurredAt: new Date().toISOString() });
      }
      if (following.length) this.logger.log(`Feed de ${userId} sincronizado con ${following.length} seguidos`);
    } catch (error) {
      // Se libera la marca para reintentar en la próxima petición.
      await this.redis.del(syncedKey(userId));
      this.logger.warn(`No se pudo sincronizar el feed de ${userId}: ${(error as Error).message}`);
    }
  }

  async purge(event: FollowEvent): Promise<void> {
    await this.rewriteFeed(event.followerId, (entries) =>
      entries.filter((e) => e.authorId !== event.followingId),
    );
  }

  // Reescribe feed:{userId} ordenado por fecha con bloqueo optimista (WATCH):
  // si un fan-out concurrente toca la lista entre la lectura y la escritura,
  // la transacción se descarta y se reintenta, así no se pierden publicaciones.
  private async rewriteFeed(
    userId: string,
    change: (entries: { postId: string; authorId: string; createdAt: string }[]) => {
      postId: string;
      authorId: string;
      createdAt: string;
    }[],
  ): Promise<void> {
    const key = feedKey(userId);
    // WATCH es por conexión: se usa una dedicada para no interferir con otras operaciones.
    const conn = this.redis.duplicate();
    try {
      for (let attempt = 0; attempt < MERGE_RETRIES; attempt++) {
        await conn.watch(key);
        const ids = await conn.lrange(key, 0, -1);
        const raw = ids.length ? await conn.mget(ids.map(postKey)) : [];
        const current = raw.flatMap((value) => {
          if (!value) return [];
          const item = JSON.parse(value) as FeedItemDto;
          return [{ postId: item.postId, authorId: item.authorId, createdAt: item.createdAt }];
        });

        const seen = new Set<string>();
        const next = change(current)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .filter((e) => (seen.has(e.postId) ? false : (seen.add(e.postId), true)))
          .slice(0, this.maxLength)
          .map((e) => e.postId);

        const tx = conn.multi().del(key);
        if (next.length) tx.rpush(key, ...next);
        if ((await tx.exec()) !== null) return;
      }
      throw new Error(`No se pudo actualizar el feed de ${userId} tras ${MERGE_RETRIES} intentos`);
    } finally {
      conn.disconnect();
    }
  }

  // ---------------------------------------------------------------------------
  // "Para ti": mezcla lo de quienes sigues (más reciente primero) con
  // publicaciones de descubrimiento (por interacción, con decaimiento por
  // antigüedad). Nunca incluye las publicaciones propias. Sin seguidos, todo es
  // descubrimiento: un usuario nuevo nunca ve el feed vacío.
  // ---------------------------------------------------------------------------
  async forYou(userId: string, type: PostKind | undefined, limit: number): Promise<ForYouDto> {
    await this.ensureSynced(userId);
    const [followingIds, feedIds] = await Promise.all([
      this.usersClient.getFollowingIds(userId).catch(() => [] as string[]),
      this.redis.lrange(feedKey(userId), 0, 199),
    ]);
    const following = new Set(followingIds);

    const snapshots = feedIds.length ? await this.redis.mget(feedIds.map(postKey)) : [];
    const followIds = snapshots
      .flatMap((value) => (value ? [JSON.parse(value) as FeedItemDto] : []))
      .filter((s) => s.authorId !== userId && following.has(s.authorId) && (!type || s.type === type))
      .slice(0, limit)
      .map((s) => s.postId);

    let discovery: PostView[] = [];
    try {
      discovery = (await this.postsClient.list({ excludeAuthorId: userId, type, limit: DISCOVERY_POOL }))
        .filter((p) => !following.has(p.authorId))
        .sort((a, b) => discoveryScore(b) - discoveryScore(a));
    } catch (error) {
      this.logger.warn(`Descubrimiento no disponible: ${(error as Error).message}`);
    }

    const followPosts = await this.postsClient.batch(followIds);

    const items: ForYouItemDto[] = [];
    let f = 0;
    let d = 0;
    while (items.length < limit && (f < followPosts.length || d < discovery.length)) {
      for (let i = 0; i < FOLLOWING_PER_DISCOVERY && f < followPosts.length && items.length < limit; i++) {
        items.push({ ...followPosts[f++], reason: 'following' });
      }
      if (d < discovery.length && items.length < limit) {
        items.push({ ...discovery[d++], reason: 'discovery' });
      }
      // Si se acabaron los seguidos, el resto se completa con descubrimiento.
      if (f >= followPosts.length) {
        while (d < discovery.length && items.length < limit) {
          items.push({ ...discovery[d++], reason: 'discovery' });
        }
      }
    }
    return { items };
  }
}

// Interacción ponderada (comentar vale más que reaccionar) dividida por la
// antigüedad: lo reciente con algo de actividad sube; lo viejo baja solo.
export function discoveryScore(post: PostView, now = Date.now()): number {
  const reactions = Object.values(post.reactions ?? {}).reduce((sum, n) => sum + n, 0);
  const engagement = 1 + reactions + 2 * post.commentsCount;
  const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 3_600_000);
  return engagement / Math.pow(ageHours + 2, 1.4);
}
