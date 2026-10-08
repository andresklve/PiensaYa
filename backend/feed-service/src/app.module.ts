import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FeedModule } from './feed.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FeedModule],
})
export class AppModule {}
