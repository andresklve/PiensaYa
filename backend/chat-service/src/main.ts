import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // CORS_ORIGIN (opcional): lista de orígenes permitidos separados por coma.
  // Sin definir (desarrollo) se acepta cualquier origen.
  const origins = process.env.CORS_ORIGIN?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : true, credentials: true });

  // Detrás de un proxy inverso (Caddy), la IP real viene en X-Forwarded-For;
  // sin esto el rate limiting vería a todos los usuarios como una sola IP.
  if (process.env.TRUST_PROXY === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(config.get<string>('REDIS_URL')!);
  app.useWebSocketAdapter(redisIoAdapter);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PiensaYa - Chat Service')
    .setDescription(
      'Chat privado 1 a 1. Tiempo real por WebSocket (Socket.IO, namespace /chat, evento send_message / new_message) y REST para historial.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3003);
}
bootstrap();
