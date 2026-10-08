import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // App híbrida: API HTTP (GET /feed) + consumidor de RabbitMQ (eventos del Post Service).
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [config.get<string>('RABBITMQ_URL')!],
      queue: config.get<string>('RABBITMQ_FEED_QUEUE'),
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: 10,
    },
  });
  await app.startAllMicroservices();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PiensaYa - Feed Service')
    .setDescription(
      'Feed pre-calculado en Redis (fan-out on write) a partir del evento PostCreated de RabbitMQ',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3004);
}
bootstrap();
