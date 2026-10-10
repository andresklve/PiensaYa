import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class UsersClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async assertUserExists(userId: string): Promise<void> {
    const baseUrl = this.config.get<string>('USER_SERVICE_URL');

    try {
      await firstValueFrom(
        this.http.get(`${baseUrl}/users/${encodeURIComponent(userId)}`, {
          timeout: 3000,
        }),
      );
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        throw new NotFoundException('El destinatario no existe');
      }
      throw new ServiceUnavailableException(
        'No se pudo verificar el destinatario (User Service no disponible)',
      );
    }
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const baseUrl = this.config.get<string>('USER_SERVICE_URL');

    try {
      const { data } = await firstValueFrom(
        this.http.get<{ following: boolean }>(
          `${baseUrl}/users/${encodeURIComponent(followerId)}/following/${encodeURIComponent(followingId)}`,
          { timeout: 3000 },
        ),
      );
      return data.following;
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo verificar la relación (User Service no disponible)',
      );
    }
  }
}
