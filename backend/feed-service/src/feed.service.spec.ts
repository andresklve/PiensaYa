import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { FeedService, feedKey, postKey } from './feed.service';
import { UsersClient } from './users.client';
import { PostCreatedEvent } from './events/post-events';

describe('FeedService', () => {
  let service: FeedService;
  let pipeline: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;
  let usersClient: { getFollowerIds: jest.Mock; getDisplayName: jest.Mock };

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
    };
    usersClient = {
      getFollowerIds: jest.fn().mockResolvedValue(['f1', 'f2']),
      getDisplayName: jest.fn().mockResolvedValue('Ana Gomez'),
    };

    service = new FeedService(
      redis as unknown as Redis,
      usersClient as unknown as UsersClient,
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
        expect.stringContaining('"authorName":"Ana Gomez"'),
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
});
