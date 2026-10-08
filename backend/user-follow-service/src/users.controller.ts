import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { FollowerItemDto } from './dto/follower-item.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './strategies/jwt.strategy';

type AuthUser = { userId: string; email: string; role: JwtPayload['role'] };

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary:
      'Crear el perfil de un usuario (llamado internamente por el Auth Service)',
  })
  @ApiResponse({ status: 201, type: UserProfileResponseDto })
  @ApiResponse({ status: 409, description: 'El perfil ya existe' })
  createProfile(
    @Body() dto: CreateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.createProfile(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener el perfil propio' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  getMyProfile(@CurrentUser() user: AuthUser): Promise<UserProfileResponseDto> {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar el perfil propio' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Obtener el perfil público de un usuario' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  @ApiResponse({ status: 404, description: 'Perfil no encontrado' })
  getProfile(
    @Param('userId') userId: string,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.getProfile(userId);
  }

  @Post(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seguir a un usuario' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'Ya sigues a este usuario' })
  follow(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.usersService.follow(user.userId, userId);
  }

  @Delete(':userId/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dejar de seguir a un usuario' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'No sigues a este usuario' })
  unfollow(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.usersService.unfollow(user.userId, userId);
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Listar los seguidores de un usuario' })
  @ApiResponse({ status: 200, type: [FollowerItemDto] })
  getFollowers(
    @Param('userId') userId: string,
  ): Promise<FollowerItemDto[]> {
    return this.usersService.getFollowers(userId);
  }

  @Get(':userId/following')
  @ApiOperation({ summary: 'Listar a quién sigue un usuario' })
  @ApiResponse({ status: 200, type: [FollowerItemDto] })
  getFollowing(
    @Param('userId') userId: string,
  ): Promise<FollowerItemDto[]> {
    return this.usersService.getFollowing(userId);
  }
}
