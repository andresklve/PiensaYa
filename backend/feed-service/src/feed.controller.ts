import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { FeedPageDto, FeedQueryDto, ForYouDto, ForYouQueryDto } from './dto/feed.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './strategies/jwt.strategy';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('for-you')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Para ti: 3 de quienes sigo por cada 1 de descubrimiento (por interacción y recencia), sin publicaciones propias',
  })
  @ApiResponse({ status: 200, type: ForYouDto })
  getForYou(@CurrentUser() user: AuthUser, @Query() query: ForYouQueryDto): Promise<ForYouDto> {
    return this.feedService.forYou(user.userId, query.type, query.limit);
  }

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
