import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import Redis from 'ioredis';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { FeedEventsController } from './feed-events.controller';
import { UsersClient } from './users.client';
import { REDIS_CLIENT, redisProvider } from './redis.provider';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [HttpModule, PassportModule],
  controllers: [FeedController, FeedEventsController],
  providers: [FeedService, UsersClient, redisProvider, JwtStrategy],
})
export class FeedModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
