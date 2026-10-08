import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-internal-token'];
    const expected = this.config.get<string>('INTERNAL_SERVICE_TOKEN');

    if (!token || token !== expected) {
      throw new UnauthorizedException('Llamada inter-servicio no autorizada');
    }

    return true;
  }
}
