import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { FEED_CLIENT } from './events/follow-events';
import { FollowEventsPublisher } from './events/follow-events.publisher';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [
    PassportModule,
    ClientsModule.registerAsync([
      {
        name: FEED_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL')!],
            queue: config.get<string>('RABBITMQ_FEED_QUEUE'),
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtStrategy, InternalServiceGuard, StorageService, FollowEventsPublisher],
})
export class UsersModule {}
