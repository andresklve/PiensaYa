import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { InternalServiceGuard } from './guards/internal-service.guard';

@Module({
  imports: [PassportModule],
  controllers: [UsersController],
  providers: [UsersService, JwtStrategy, InternalServiceGuard],
})
export class UsersModule {}
