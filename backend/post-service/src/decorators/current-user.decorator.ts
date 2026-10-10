import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../strategies/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);

// Con OptionalJwtAuthGuard: el id del usuario si mandó token, si no undefined.
export const ViewerId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    (ctx.switchToHttp().getRequest().user as AuthUser | undefined)?.userId,
);
