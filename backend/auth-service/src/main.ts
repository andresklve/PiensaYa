import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const config = new DocumentBuilder()
    .setTitle('PiensaYa - Auth Service')
    .setDescription('Registro, login y emisión de JWT')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
