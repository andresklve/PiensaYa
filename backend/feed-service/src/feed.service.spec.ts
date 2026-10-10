import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { FeedService, discoveryScore, feedKey, postKey, syncedKey } from './feed.service';
import { UsersClient } from './users.client';
import { PostsClient, PostView } from './posts.client';
import { PostCreatedEvent } from './events/post-events';

describe('FeedService', () => {
  let service: FeedService;
  let pipeline: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;
  let usersClient: { getFollowerIds: jest.Mock; getAuthorInfo: jest.Mock; getFollowingIds: jest.Mock };
  let postsClient: { list: jest.Mock; batch: jest.Mock };
  let conn: Record<string, jest.Mock>;
  let tx: Record<string, jest.Mock>;

  const event: PostCreatedEvent = {
    postId: 'p1',
    authorId: 'author',
    type: 'TWEET',
    excerpt: 'hola',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    pipeline = {
      set: jest.fn(),
      lrem: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redis = {
      pipeline: jest.fn().mockReturnValue(pipeline),
      del: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      mget: jest.fn(),
      // Por defecto el feed ya está sincronizado (SET NX no reclama la marca).
      set: jest.fn().mockResolvedValue(null),
    };
    usersClient = {
      getFollowerIds: jest.fn().mockResolvedValue(['f1', 'f2']),
      getAuthorInfo: jest.fn().mockResolvedValue({ name: 'Ana Gomez', username: 'ana' }),
      getFollowingIds: jest.fn().mockResolvedValue([]),
    };
    postsClient = { list: jest.fn().mockResolvedValue([]), batch: jest.fn().mockResolvedValue([]) };
    tx = { del: jest.fn(), rpush: jest.fn(), exec: jest.fn().mockResolvedValue([]) };
    tx.del.mockReturnValue(tx);
    tx.rpush.mockReturnValue(tx);
    conn = {
      watch: jest.fn(),
      lrange: jest.fn().mockResolvedValue([]),
      mget: jest.fn().mockResolvedValue([]),
      multi: jest.fn().mockReturnValue(tx),
      disconnect: jest.fn(),
    };
    redis.duplicate = jest.fn().mockReturnValue(conn);

    service = new FeedService(
      redis as unknown as Redis,
      usersClient as unknown as UsersClient,
      postsClient as unknown as PostsClient,
      { get: () => '500' } as unknown as ConfigService,
    );
  });

  describe('fanOut', () => {
    it('distribuye el post al autor y a todos sus seguidores', async () => {
      const recipients = await service.fanOut(event);

      expect(recipients).toBe(3);
      for (const userId of ['author', 'f1', 'f2']) {
        expect(pipeline.lpush).toHaveBeenCalledWith(feedKey(userId), 'p1');
        expect(pipeline.ltrim).toHaveBeenCalledWith(feedKey(userId), 0, 499);
      }
      expect(pipeline.set).toHaveBeenCalledWith(
        postKey('p1'),
        expect.stringContaining('"authorName":"Ana Gomez","authorUsername":"ana"'),
      );
    });

    it('es idempotente: elimina el postId antes de volver a insertarlo', async () => {
      await service.fanOut(event);

      const lremOrder = pipeline.lrem.mock.invocationCallOrder[0];
      const lpushOrder = pipeline.lpush.mock.invocationCallOrder[0];
      expect(lremOrder).toBeLessThan(lpushOrder);
    });

    it('propaga el error si el User Service falla (para reintentar el evento)', async () => {
      usersClient.getFollowerIds.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.fanOut(event)).rejects.toThrow('ECONNREFUSED');
      expect(pipeline.exec).not.toHaveBeenCalled();
    });
  });

  describe('getFeed', () => {
    it('devuelve los posts y limpia las referencias a posts eliminados', async () => {
      redis.lrange.mockResolvedValue(['p1', 'p2']);
      redis.llen.mockResolvedValue(2);
      redis.mget.mockResolvedValue([JSON.stringify({ postId: 'p1' }), null]);

      const page = await service.getFeed('u1', 1, 20);

      expect(page.items).toEqual([{ postId: 'p1' }]);
      expect(page.total).toBe(1);
      expect(pipeline.lrem).toHaveBeenCalledWith(feedKey('u1'), 0, 'p2');
    });

    it('devuelve un feed vacío sin consultar snapshots', async () => {
      redis.lrange.mockResolvedValue([]);
      redis.llen.mockResolvedValue(0);

      const page = await service.getFeed('u1', 1, 20);

      expect(page.items).toEqual([]);
      expect(redis.mget).not.toHaveBeenCalled();
    });
  });

  describe('removePost', () => {
    it('borra el snapshot compartido del post', async () => {
      await service.removePost({ postId: 'p1', authorId: 'author' });
      expect(redis.del).toHaveBeenCalledWith(postKey('p1'));
    });
  });

  const post = (id: string, authorId: string, createdAt: string, extra: Partial<PostView> = {}): PostView => ({
    id,
    authorId,
    type: 'TWEET',
    content: `contenido ${id}`,
    commentsCount: 0,
    reactions: {},
    createdAt,
    updatedAt: createdAt,
    ...extra,
  });
  const snapshot = (postId: string, authorId: string, createdAt: string, type = 'TWEET') =>
    JSON.stringify({ postId, authorId, type, excerpt: '', createdAt });

  describe('backfill', () => {
    it('mezcla las publicaciones anteriores por fecha con las que ya había', async () => {
      postsClient.list.mockResolvedValue([
        post('viejo', 'nuevo-seguido', '2026-01-01T00:00:00.000Z'),
        post('medio', 'nuevo-seguido', '2026-01-03T00:00:00.000Z'),
      ]);
      conn.lrange.mockResolvedValue(['reciente', 'antiguo']);
      conn.mget.mockResolvedValue([
        snapshot('reciente', 'otro', '2026-01-05T00:00:00.000Z'),
        snapshot('antiguo', 'otro', '2026-01-02T00:00:00.000Z'),
      ]);

      const added = await service.backfill({ followerId: 'yo', followingId: 'nuevo-seguido', occurredAt: '' });

      expect(added).toBe(2);
      expect(postsClient.list).toHaveBeenCalledWith({ authorId: 'nuevo-seguido', limit: 20 });
      expect(pipeline.set).toHaveBeenCalledWith(postKey('viejo'), expect.any(String), 'NX');
      expect(tx.rpush).toHaveBeenCalledWith(feedKey('yo'), 'reciente', 'medio', 'antiguo', 'viejo');
      expect(conn.disconnect).toHaveBeenCalled();
    });

    it('reintenta si otro proceso modificó el feed a la vez (WATCH)', async () => {
      postsClient.list.mockResolvedValue([post('a', 'x', '2026-01-01T00:00:00.000Z')]);
      tx.exec.mockResolvedValueOnce(null).mockResolvedValueOnce([]);

      await service.backfill({ followerId: 'yo', followingId: 'x', occurredAt: '' });

      expect(conn.watch).toHaveBeenCalledTimes(2);
    });
  });

  describe('purge', () => {
    it('quita del feed solo las publicaciones de quien dejaste de seguir', async () => {
      conn.lrange.mockResolvedValue(['p1', 'p2', 'p3']);
      conn.mget.mockResolvedValue([
        snapshot('p1', 'se-va', '2026-01-03T00:00:00.000Z'),
        snapshot('p2', 'se-queda', '2026-01-02T00:00:00.000Z'),
        snapshot('p3', 'se-va', '2026-01-01T00:00:00.000Z'),
      ]);

      await service.purge({ followerId: 'yo', followingId: 'se-va', occurredAt: '' });

      expect(tx.rpush).toHaveBeenCalledWith(feedKey('yo'), 'p2');
    });
  });

  describe('forYou', () => {
    it('sin seguidos devuelve solo descubrimiento y nunca lo propio', async () => {
      redis.lrange.mockResolvedValue([]);
      postsClient.list.mockResolvedValue([post('d1', 'ajeno', new Date().toISOString())]);

      const { items } = await service.forYou('yo', undefined, 30);

      expect(postsClient.list).toHaveBeenCalledWith(expect.objectContaining({ excludeAuthorId: 'yo' }));
      expect(items.map((i) => [i.id, i.reason])).toEqual([['d1', 'discovery']]);
    });

    it('intercala 3 de seguidos por cada 1 de descubrimiento', async () => {
      usersClient.getFollowingIds.mockResolvedValue(['amiga']);
      const ids = ['f1', 'f2', 'f3', 'f4'];
      redis.lrange.mockResolvedValue(ids);
      redis.mget.mockResolvedValue(ids.map((id) => snapshot(id, 'amiga', '2026-01-01T00:00:00.000Z')));
      postsClient.batch.mockImplementation((req: string[]) =>
        Promise.resolve(req.map((id) => post(id, 'amiga', '2026-01-01T00:00:00.000Z'))),
      );
      const now = new Date().toISOString();
      postsClient.list.mockResolvedValue([
        post('d1', 'ajeno', now),
        post('d2', 'ajeno', now),
        post('de-amiga', 'amiga', now),
      ]);

      const { items } = await service.forYou('yo', undefined, 30);

      expect(items.map((i) => i.id)).toEqual(['f1', 'f2', 'f3', 'd1', 'f4', 'd2']);
      expect(items.find((i) => i.id === 'de-amiga')).toBeUndefined();
    });

    it('filtra por tipo y excluye lo propio del feed de seguidos', async () => {
      usersClient.getFollowingIds.mockResolvedValue(['amiga']);
      redis.lrange.mockResolvedValue(['mio', 'art', 'apunte']);
      redis.mget.mockResolvedValue([
        snapshot('mio', 'yo', '2026-01-03T00:00:00.000Z', 'POST'),
        snapshot('art', 'amiga', '2026-01-02T00:00:00.000Z', 'POST'),
        snapshot('apunte', 'amiga', '2026-01-01T00:00:00.000Z', 'TWEET'),
      ]);

      await service.forYou('yo', 'POST', 30);

      expect(postsClient.batch).toHaveBeenCalledWith(['art']);
    });
  });

  describe('discoveryScore', () => {
    it('a igual antigüedad gana lo que tiene más interacción', () => {
      const now = Date.now();
      const created = new Date(now - 3_600_000).toISOString();
      const quiet = post('a', 'x', created);
      const lively = post('b', 'x', created, { commentsCount: 2, reactions: { LIKE: 3 } });
      expect(discoveryScore(lively, now)).toBeGreaterThan(discoveryScore(quiet, now));
    });

    it('a igual interacción gana lo más reciente', () => {
      const now = Date.now();
      const recent = post('a', 'x', new Date(now - 3_600_000).toISOString());
      const old = post('b', 'x', new Date(now - 72 * 3_600_000).toISOString());
      expect(discoveryScore(recent, now)).toBeGreaterThan(discoveryScore(old, now));
    });
  });

  describe('ensureSynced', () => {
    it('la primera vez trae lo anterior de todas las personas seguidas', async () => {
      redis.set.mockResolvedValueOnce('OK');
      usersClient.getFollowingIds.mockResolvedValue(['a', 'b']);
      postsClient.list.mockResolvedValue([post('x', 'a', '2026-01-01T00:00:00.000Z')]);

      await service.ensureSynced('yo');

      expect(redis.set).toHaveBeenCalledWith(syncedKey('yo'), expect.any(String), 'NX');
      expect(postsClient.list).toHaveBeenCalledWith({ authorId: 'a', limit: 20 });
      expect(postsClient.list).toHaveBeenCalledWith({ authorId: 'b', limit: 20 });
    });

    it('no repite la sincronización si ya se hizo', async () => {
      redis.set.mockResolvedValueOnce(null);

      await service.ensureSynced('yo');

      expect(usersClient.getFollowingIds).not.toHaveBeenCalled();
    });

    it('si falla, libera la marca para reintentar', async () => {
      redis.set.mockResolvedValueOnce('OK');
      usersClient.getFollowingIds.mockRejectedValue(new Error('caído'));

      await service.ensureSynced('yo');

      expect(redis.del).toHaveBeenCalledWith(syncedKey('yo'));
    });
  });
});
