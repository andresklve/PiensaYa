import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../strategies/jwt.strategy';

// Lecturas públicas: sin token pasa como anónimo. Con un token inválido o
// vencido responde 401, para que el cliente lo renueve en vez de recibir en
// silencio datos de anónimo (sin su reacción).
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthUser | undefined>(
    err: unknown,
    user: AuthUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const hasToken = !!context.switchToHttp().getRequest().headers.authorization;
    if (!hasToken) return undefined as TUser;
    if (err || !user) throw new UnauthorizedException();
    return user as TUser;
  }
}
