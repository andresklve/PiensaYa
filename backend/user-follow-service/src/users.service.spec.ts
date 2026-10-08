import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from './prisma/prisma.service';

describe('UsersService', () => {
  let usersService: UsersService;
  let prisma: {
    userProfile: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    follow: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      userProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      follow: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    usersService = new UsersService(prisma as unknown as PrismaService);
  });

  describe('createProfile', () => {
    it('lanza ConflictException si el perfil ya existe', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ userId: '1' });

      await expect(
        usersService.createProfile({
          userId: '1',
          firstName: 'Juan',
          lastName: 'Perez',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('crea el perfil cuando no existe', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      prisma.userProfile.create.mockResolvedValue({
        userId: '1',
        firstName: 'Juan',
        lastName: 'Perez',
        bio: null,
        avatarUrl: null,
      });

      const result = await usersService.createProfile({
        userId: '1',
        firstName: 'Juan',
        lastName: 'Perez',
      });

      expect(result.userId).toBe('1');
      expect(result.followersCount).toBe(0);
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
    });

    it('crea el follow cuando todo es válido', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ userId: '2' });
      prisma.follow.findUnique.mockResolvedValue(null);
      prisma.follow.create.mockResolvedValue({});

      await usersService.follow('1', '2');

      expect(prisma.follow.create).toHaveBeenCalledWith({
        data: { followerId: '1', followingId: '2' },
      });
    });
  });
});
