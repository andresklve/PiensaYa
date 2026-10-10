import { Module } from '@nestjs/common';
import { ThrottleModule } from './throttle/throttle';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottleModule,
    PrismaModule,
    AuthModule,
  ],
})
export class AppModule {}
