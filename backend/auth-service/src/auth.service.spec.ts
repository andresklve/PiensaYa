import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as bcrypt from 'bcrypt';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma/prisma.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: Partial<JwtService>;
  let config: Partial<ConfigService>;
  let httpService: Partial<HttpService>;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      verifyAsync: jest.fn(),
    };
    config = {
      get: jest.fn().mockImplementation((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_EXPIRES_SECONDS: '900',
          JWT_REFRESH_EXPIRES_SECONDS: '604800',
          JWT_REFRESH_SECRET: 'refresh-secret',
          USER_SERVICE_URL: 'http://localhost:3001',
          INTERNAL_SERVICE_TOKEN: 'internal-secret',
        };
        return values[key];
      }),
    };
    httpService = {
      post: jest.fn().mockReturnValue(of({ data: {} })),
    };

    authService = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as JwtService,
      config as ConfigService,
      httpService as HttpService,
    );
  });

  describe('register', () => {
    it('lanza ConflictException si el username ya existe', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', username: 'carlos' });

      await expect(
        authService.register({
          username: 'carlos',
          password: 'Password123',
          firstName: 'Juan',
          lastName: 'Perez',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('crea el usuario y devuelve tokens cuando el username no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: '1',
        username: 'nuevo_user',
        role: 'USUARIO',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await authService.register({
        username: 'nuevo_user',
        password: 'Password123',
        firstName: 'Juan',
        lastName: 'Perez',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.userId).toBe('1');
      expect(result.username).toBe('nuevo_user');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: '1', username: 'nuevo_user', role: 'USUARIO' },
        expect.anything(),
      );
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:3001/users',
        expect.objectContaining({ userId: '1', username: 'nuevo_user' }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-internal-token': expect.any(String),
          }),
        }),
      );
    });
  });

  describe('login', () => {
    it('lanza UnauthorizedException si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ username: 'noexiste', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el password no coincide', async () => {
      const passwordHash = await bcrypt.hash('correcta', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        username: 'carlos',
        passwordHash,
        role: 'USUARIO',
      });

      await expect(
        authService.login({ username: 'carlos', password: 'incorrecta' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devuelve tokens cuando las credenciales son correctas', async () => {
      const passwordHash = await bcrypt.hash('correcta', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        username: 'carlos',
        passwordHash,
        role: 'USUARIO',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await authService.login({
        username: 'carlos',
        password: 'correcta',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBe('signed.jwt.token');
    });
  });
});
