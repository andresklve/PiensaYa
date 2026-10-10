import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { SuggestQueryDto, TagCountDto } from './dto/search.dto';

@ApiTags('hashtags')
@Controller('hashtags')
export class HashtagsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('suggest')
  @ApiOperation({
    summary: 'Autocompletar hashtags existentes (los que empiezan con lo escrito primero, luego los más usados)',
  })
  @ApiResponse({ status: 200, type: [TagCountDto] })
  suggest(@Query() query: SuggestQueryDto): Promise<TagCountDto[]> {
    return this.postsService.suggestTags(query.q, query.limit);
  }
}
