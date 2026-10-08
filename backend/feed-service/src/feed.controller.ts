import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { FeedPageDto, FeedQueryDto } from './dto/feed.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './strategies/jwt.strategy';

type AuthUser = { userId: string; email: string; role: JwtPayload['role'] };

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Mi feed: publicaciones propias y de las personas que sigo (pre-calculado en Redis)',
  })
  @ApiResponse({ status: 200, type: FeedPageDto })
  getMyFeed(
    @CurrentUser() user: AuthUser,
    @Query() query: FeedQueryDto,
  ): Promise<FeedPageDto> {
    return this.feedService.getFeed(user.userId, query.page, query.limit);
  }
}
