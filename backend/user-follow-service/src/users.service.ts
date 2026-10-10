import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { FollowerItemDto } from './dto/follower-item.dto';
import { StorageService } from './storage/storage.service';
import { FollowEventsPublisher } from './events/follow-events.publisher';
import {
  ProfileImageKind,
  processProfileImage,
} from './storage/profile-images';
import type { UploadedImage } from './storage/profile-images';

const IMAGE_FIELD = { avatar: 'avatarUrl', cover: 'coverUrl' } as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly followEvents: FollowEventsPublisher,
  ) {}

  async createProfile(
    dto: CreateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    const existing = await this.prisma.userProfile.findFirst({
      where: { OR: [{ userId: dto.userId }, { username: dto.username }] },
    });

    if (existing) {
      throw new ConflictException('El perfil ya existe para este usuario');
    }

    const profile = await this.prisma.userProfile.create({
      data: {
        userId: dto.userId,
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    return this.toResponseDto(profile, 0, 0);
  }

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const profile = await this.findProfileOrThrow(userId);
    const [followersCount, followingCount] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return this.toResponseDto(profile, followersCount, followingCount);
  }

  async getProfileByUsername(
    username: string,
  ): Promise<UserProfileResponseDto> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    if (!profile) {
      throw new NotFoundException('Perfil no encontrado');
    }

    return this.getProfile(profile.userId);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    await this.findProfileOrThrow(userId);

    const profile = await this.prisma.userProfile.update({
      where: { userId },
      data: dto,
    });

    const [followersCount, followingCount] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return this.toResponseDto(profile, followersCount, followingCount);
  }

  // Procesa la imagen, la sube con un nombre nuevo (las URLs son inmutables y
  // cacheables) y recién después borra la anterior.
  async setProfileImage(
    userId: string,
    kind: ProfileImageKind,
    file: UploadedImage | undefined,
  ): Promise<UserProfileResponseDto> {
    if (!file) {
      throw new BadRequestException('Adjunta una imagen en el campo "file"');
    }
    const previous = await this.findProfileOrThrow(userId);
    const image = await processProfileImage(file.buffer, kind);
    const url = await this.storage.put(
      `${kind}s/${userId}/${randomUUID()}.webp`,
      image,
      'image/webp',
    );

    await this.prisma.userProfile.update({
      where: { userId },
      data: { [IMAGE_FIELD[kind]]: url },
    });
    await this.storage.deleteByUrl(previous[IMAGE_FIELD[kind]]);

    return this.getProfile(userId);
  }

  async removeProfileImage(
    userId: string,
    kind: ProfileImageKind,
  ): Promise<UserProfileResponseDto> {
    const previous = await this.findProfileOrThrow(userId);
    await this.prisma.userProfile.update({
      where: { userId },
      data: { [IMAGE_FIELD[kind]]: null },
    });
    await this.storage.deleteByUrl(previous[IMAGE_FIELD[kind]]);
    return this.getProfile(userId);
  }

  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('No puedes seguirte a ti mismo');
    }

    await this.findProfileOrThrow(followingId);

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existing) {
      throw new ConflictException('Ya sigues a este usuario');
    }

    await this.prisma.follow.create({ data: { followerId, followingId } });
    this.followEvents.followed(followerId, followingId);
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    await this.prisma.follow
      .delete({
        where: { followerId_followingId: { followerId, followingId } },
      })
      .catch(() => {
        throw new NotFoundException('No sigues a este usuario');
      });
    this.followEvents.unfollowed(followerId, followingId);
  }

  // Búsqueda por nombre, apellido o @username. Con varias palabras ("carlos
  // inf") cada una debe aparecer en alguno de los tres campos.
  async search(query: string, limit = 10): Promise<FollowerItemDto[]> {
    const words = query
      .trim()
      .replace(/^@/, '')
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 4);
    if (words.length === 0) return [];

    const profiles = await this.prisma.userProfile.findMany({
      where: {
        AND: words.map((w) => ({
          OR: [
            { username: { contains: w.toLowerCase() } },
            { firstName: { contains: w, mode: 'insensitive' as const } },
            { lastName: { contains: w, mode: 'insensitive' as const } },
          ],
        })),
      },
      orderBy: { username: 'asc' },
      take: Math.min(Math.max(limit, 1), 20),
    });
    return profiles.map((p) => this.toFollowerItem(p));
  }

  async getFollowers(userId: string): Promise<FollowerItemDto[]> {
    await this.findProfileOrThrow(userId);

    const follows = await this.prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: true },
    });

    return follows.map((f) => this.toFollowerItem(f.follower));
  }

  async getFollowing(userId: string): Promise<FollowerItemDto[]> {
    await this.findProfileOrThrow(userId);

    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: true },
    });

    return follows.map((f) => this.toFollowerItem(f.following));
  }

  private async findProfileOrThrow(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil no encontrado');
    }

    return profile;
  }

  private toResponseDto(
    profile: {
      userId: string;
      username: string;
      firstName: string;
      lastName: string;
      bio: string | null;
      avatarUrl: string | null;
      coverUrl: string | null;
    },
    followersCount: number,
    followingCount: number,
  ): UserProfileResponseDto {
    return {
      userId: profile.userId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coverUrl: profile.coverUrl,
      followersCount,
      followingCount,
    };
  }

  private toFollowerItem(profile: {
    userId: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  }): FollowerItemDto {
    return {
      userId: profile.userId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
    };
  }
}
