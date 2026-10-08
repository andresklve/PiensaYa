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
}
