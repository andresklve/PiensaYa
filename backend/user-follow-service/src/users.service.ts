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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(
    dto: CreateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    const existing = await this.prisma.userProfile.findUnique({
      where: { userId: dto.userId },
    });

    if (existing) {
      throw new ConflictException('El perfil ya existe para este usuario');
    }

    const profile = await this.prisma.userProfile.create({
      data: {
        userId: dto.userId,
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
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    await this.prisma.follow
      .delete({
        where: { followerId_followingId: { followerId, followingId } },
      })
      .catch(() => {
        throw new NotFoundException('No sigues a este usuario');
      });
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
      firstName: string;
      lastName: string;
      bio: string | null;
      avatarUrl: string | null;
    },
    followersCount: number,
    followingCount: number,
  ): UserProfileResponseDto {
    return {
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      followersCount,
      followingCount,
    };
  }

  private toFollowerItem(profile: {
    userId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  }): FollowerItemDto {
    return {
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
    };
  }
}
