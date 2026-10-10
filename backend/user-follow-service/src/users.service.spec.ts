import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from './prisma/prisma.service';
import sharp from 'sharp';
import { StorageService } from './storage/storage.service';
import { FollowEventsPublisher } from './events/follow-events.publisher';

describe('UsersService', () => {
  let usersService: UsersService;
  let prisma: {
    userProfile: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    follow: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
  };
  let storage: { put: jest.Mock; deleteByUrl: jest.Mock };
  let followEvents: { followed: jest.Mock; unfollowed: jest.Mock };

  beforeEach(() => {
    prisma = {
      userProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      follow: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    storage = { put: jest.fn(), deleteByUrl: jest.fn() };

    followEvents = { followed: jest.fn(), unfollowed: jest.fn() };

    usersService = new UsersService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      followEvents as unknown as FollowEventsPublisher,
    );
  });

  describe('createProfile', () => {
    it('lanza ConflictException si el perfil o el username ya existen', async () => {
      prisma.userProfile.findFirst.mockResolvedValue({ userId: '1' });

      await expect(
        usersService.createProfile({
          userId: '1',
          username: 'juan',
          firstName: 'Juan',
          lastName: 'Perez',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('crea el perfil con su username cuando no existe', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(null);
      prisma.userProfile.create.mockResolvedValue({
        userId: '1',
        username: 'juan',
        firstName: 'Juan',
        lastName: 'Perez',
        bio: null,
        avatarUrl: null,
      });

      const result = await usersService.createProfile({
        userId: '1',
        username: 'juan',
        firstName: 'Juan',
        lastName: 'Perez',
      });

      expect(prisma.userProfile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ username: 'juan' }),
      });
      expect(result.username).toBe('juan');
      expect(result.followersCount).toBe(0);
    });
  });

  describe('getProfileByUsername', () => {
    it('busca sin importar mayúsculas', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(usersService.getProfileByUsername('  JUAN ')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { username: 'juan' },
      });
    });
  });

  describe('follow', () => {
    it('lanza BadRequestException si intenta seguirse a sí mismo', async () => {
      await expect(usersService.follow('1', '1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza NotFoundException si el usuario a seguir no existe', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(usersService.follow('1', '2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza ConflictException si ya lo sigue', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ userId: '2' });
      prisma.follow.findUnique.mockResolvedValue({
        followerId: '1',
        followingId: '2',
      });

      await expect(usersService.follow('1', '2')).rejects.toThrow(
        ConflictException,
      );
      expect(followEvents.followed).not.toHaveBeenCalled();
    });

    it('crea el follow cuando todo es válido', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ userId: '2' });
      prisma.follow.findUnique.mockResolvedValue(null);
      prisma.follow.create.mockResolvedValue({});

      await usersService.follow('1', '2');

      expect(prisma.follow.create).toHaveBeenCalledWith({
        data: { followerId: '1', followingId: '2' },
      });
      expect(followEvents.followed).toHaveBeenCalledWith('1', '2');
    });
  });

  describe('search', () => {
    it('cada palabra debe coincidir con nombre, apellido o username', async () => {
      (prisma.userProfile as unknown as { findMany: jest.Mock }).findMany = jest.fn().mockResolvedValue([]);

      await usersService.search('@Carlos inf');

      const where = (prisma.userProfile as unknown as { findMany: jest.Mock }).findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(2);
      expect(where.AND[0].OR[0]).toEqual({ username: { contains: 'carlos' } });
      expect(where.AND[1].OR[1]).toEqual({ firstName: { contains: 'inf', mode: 'insensitive' } });
    });

    it('una búsqueda vacía no consulta la base', async () => {
      await expect(usersService.search('   ')).resolves.toEqual([]);
    });
  });

  describe('getFollowers / getFollowing', () => {
    it('sin limit devuelve la lista completa, más recientes primero', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ userId: '1' });
      prisma.follow.findMany.mockResolvedValue([]);

      await usersService.getFollowers('1');

      const args = prisma.follow.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
      expect(args.take).toBeUndefined();
    });

    it('con limit y offset pagina', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ userId: '1' });
      prisma.follow.findMany.mockResolvedValue([]);

      await usersService.getFollowing('1', { limit: 20, offset: 40 });

      expect(prisma.follow.findMany.mock.calls[0][0]).toMatchObject({
        take: 20,
        skip: 40,
      });
    });
  });

  describe('isFollowing', () => {
    it('true si existe la relación', async () => {
      prisma.follow.findUnique.mockResolvedValue({ followerId: 'a' });
      await expect(usersService.isFollowing('a', 'b')).resolves.toBe(true);
    });

    it('false si no existe', async () => {
      prisma.follow.findUnique.mockResolvedValue(null);
      await expect(usersService.isFollowing('a', 'b')).resolves.toBe(false);
    });
  });

  describe('getSuggestions', () => {
    const p = (userId: string) => ({
      userId,
      username: userId,
      firstName: userId,
      lastName: 'X',
      avatarUrl: null,
    });

    it('prioriza amigos de amigos y completa con los más seguidos y los nuevos', async () => {
      // a sigue a b; b sigue a c; d es popular; e es nuevo.
      prisma.follow.findMany.mockResolvedValue([{ followingId: 'b' }]);
      prisma.follow.groupBy
        .mockResolvedValueOnce([{ followingId: 'c', _count: { followingId: 2 } }])
        .mockResolvedValueOnce([{ followingId: 'd', _count: { followingId: 9 } }]);
      prisma.userProfile.findMany
        .mockResolvedValueOnce([{ userId: 'e' }])
        .mockResolvedValueOnce([p('e'), p('d'), p('c')]);

      const result = await usersService.getSuggestions('a', 3);

      expect(result.map((s) => [s.userId, s.mutualCount])).toEqual([
        ['c', 2],
        ['d', 0],
        ['e', 0],
      ]);
      const secondHopWhere = prisma.follow.groupBy.mock.calls[0][0].where;
      expect(secondHopWhere.followingId.notIn).toEqual(
        expect.arrayContaining(['a', 'b']),
      );
    });

    it('sin seguidos salta directo a los más seguidos', async () => {
      prisma.follow.findMany.mockResolvedValue([]);
      prisma.follow.groupBy.mockResolvedValueOnce([
        { followingId: 'd', _count: { followingId: 9 } },
      ]);
      prisma.userProfile.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([p('d')]);

      const result = await usersService.getSuggestions('a', 2);

      expect(prisma.follow.groupBy).toHaveBeenCalledTimes(1);
      expect(result.map((s) => s.userId)).toEqual(['d']);
    });
  });

  describe('unfollow', () => {
    it('publica user_unfollowed al dejar de seguir', async () => {
      prisma.follow.delete.mockResolvedValue({});

      await usersService.unfollow('1', '2');

      expect(followEvents.unfollowed).toHaveBeenCalledWith('1', '2');
    });

    it('no publica nada si no lo seguía', async () => {
      prisma.follow.delete.mockRejectedValue(new Error('no existe'));

      await expect(usersService.unfollow('1', '2')).rejects.toThrow(NotFoundException);
      expect(followEvents.unfollowed).not.toHaveBeenCalled();
    });
  });

  describe('setProfileImage', () => {
    const profile = {
      userId: '1',
      username: 'juan',
      firstName: 'Juan',
      lastName: 'Perez',
      bio: null,
      avatarUrl: 'http://localhost:9090/piensaya-media/avatars/1/vieja.webp',
      coverUrl: null,
    };

    it('lanza BadRequestException si no llega archivo', async () => {
      await expect(
        usersService.setProfileImage('1', 'avatar', undefined),
      ).rejects.toThrow(BadRequestException);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('rechaza un archivo que no es imagen aunque diga serlo', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(profile);
      const fake = Buffer.from('esto no es un jpg');

      await expect(
        usersService.setProfileImage('1', 'avatar', { buffer: fake, size: fake.length }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('sube la imagen nueva, guarda la URL y borra la anterior', async () => {
      const png = await sharp({
        create: { width: 800, height: 600, channels: 3, background: '#ffd60a' },
      })
        .png()
        .toBuffer();
      prisma.userProfile.findUnique.mockResolvedValue(profile);
      prisma.userProfile.update.mockResolvedValue(profile);
      prisma.follow.count.mockResolvedValue(0);
      storage.put.mockResolvedValue('http://localhost:9090/piensaya-media/avatars/1/nueva.webp');

      await usersService.setProfileImage('1', 'avatar', { buffer: png, size: png.length });

      const [key, body, type] = storage.put.mock.calls[0];
      expect(key).toMatch(/^avatars\/1\/.+\.webp$/);
      expect(type).toBe('image/webp');
      const meta = await sharp(body as Buffer).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 400, height: 400 });
      expect(prisma.userProfile.update).toHaveBeenCalledWith({
        where: { userId: '1' },
        data: { avatarUrl: 'http://localhost:9090/piensaya-media/avatars/1/nueva.webp' },
      });
      expect(storage.deleteByUrl).toHaveBeenCalledWith(profile.avatarUrl);
    });

    it('genera la portada en 1500x500', async () => {
      const jpg = await sharp({
        create: { width: 2000, height: 2000, channels: 3, background: '#111110' },
      })
        .jpeg()
        .toBuffer();
      prisma.userProfile.findUnique.mockResolvedValue(profile);
      prisma.follow.count.mockResolvedValue(0);
      storage.put.mockResolvedValue('http://localhost:9090/piensaya-media/covers/1/x.webp');

      await usersService.setProfileImage('1', 'cover', { buffer: jpg, size: jpg.length });

      const meta = await sharp(storage.put.mock.calls[0][1] as Buffer).metadata();
      expect(meta).toMatchObject({ width: 1500, height: 500 });
    });
  });
});
