import { ThrottlerModule } from '@nestjs/throttler';

// Rate limiting por IP. No es global: solo se aplica (con @UseGuards(ThrottlerGuard)
// y @Throttle) a las rutas sensibles, para no frenar la navegación normal.
// THROTTLE_DISABLED=true lo apaga (útil para pruebas de carga o e2e locales).
export const ThrottleModule = ThrottlerModule.forRoot({
  throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
  skipIf: () => process.env.THROTTLE_DISABLED === 'true',
});

// Límites por minuto.
export const perMinute = (limit: number) => ({
  default: { limit, ttl: 60_000 },
});
