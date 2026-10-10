import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface FollowerItem {
  userId: string;
}

interface UserProfile {
  username: string;
  firstName: string;
  lastName: string;
}

export interface AuthorInfo {
  name: string;
  username: string;
}

@Injectable()
export class UsersClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getFollowerIds(userId: string): Promise<string[]> {
    const { data } = await firstValueFrom(
      this.http.get<FollowerItem[]>(
        `${this.baseUrl()}/users/${encodeURIComponent(userId)}/followers`,
        { timeout: 5000 },
      ),
    );
    return data.map((f) => f.userId);
  }

  async getFollowingIds(userId: string): Promise<string[]> {
    const { data } = await firstValueFrom(
      this.http.get<FollowerItem[]>(
        `${this.baseUrl()}/users/${encodeURIComponent(userId)}/following`,
        { timeout: 5000 },
      ),
    );
    return data.map((f) => f.userId);
  }

  async getAuthorInfo(userId: string): Promise<AuthorInfo | undefined> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<UserProfile>(
          `${this.baseUrl()}/users/${encodeURIComponent(userId)}`,
          { timeout: 3000 },
        ),
      );
      return {
        name: `${data.firstName} ${data.lastName}`,
        username: data.username,
      };
    } catch {
      return undefined;
    }
  }

  private baseUrl(): string {
    return this.config.get<string>('USER_SERVICE_URL')!;
  }
}
