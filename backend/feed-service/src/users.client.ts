import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface FollowerItem {
  userId: string;
}

interface UserProfile {
  firstName: string;
  lastName: string;
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

  async getDisplayName(userId: string): Promise<string | undefined> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<UserProfile>(
          `${this.baseUrl()}/users/${encodeURIComponent(userId)}`,
          { timeout: 3000 },
        ),
      );
      return `${data.firstName} ${data.lastName}`;
    } catch {
      return undefined;
    }
  }

  private baseUrl(): string {
    return this.config.get<string>('USER_SERVICE_URL')!;
  }
}
