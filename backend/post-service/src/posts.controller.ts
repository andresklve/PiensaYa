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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import type { AuthUser } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReactDto } from './dto/react.dto';
import { PaginatedPostsDto, PostResponseDto } from './dto/post-response.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CommentWithContextDto, OwnPostActivityDto } from './dto/activity.dto';
import { SearchQueryDto, SearchResultDto } from './dto/search.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { CurrentUser, ViewerId } from './decorators/current-user.decorator';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publicar un artículo (POST), un apunte (TWEET) o una opinión (OPINION)' })
  @ApiResponse({ status: 201, type: PostResponseDto })
  @ApiResponse({ status: 400, description: 'Apunte > 280, opinión > 600 caracteres o artículo sin título' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    return this.postsService.create(user.userId, dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar publicaciones (paginado, filtrable por autor y tipo)' })
  @ApiResponse({ status: 200, type: PaginatedPostsDto })
  list(@Query() query: ListPostsQueryDto, @ViewerId() viewerId?: string): Promise<PaginatedPostsDto> {
    return this.postsService.list(query, viewerId);
  }

  @Get('search')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Buscar por tema: hashtags que coinciden y publicaciones con esos hashtags o la palabra en el texto',
  })
  @ApiResponse({ status: 200, type: SearchResultDto })
  search(@Query() query: SearchQueryDto, @ViewerId() viewerId?: string): Promise<SearchResultDto> {
    return this.postsService.search(query, viewerId);
  }

  @Get('batch')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener varias publicaciones por id (máx. 50), en el orden pedido' })
  @ApiQuery({ name: 'ids', description: 'Ids separados por coma' })
  @ApiResponse({ status: 200, type: [PostResponseDto] })
  batch(@Query('ids') ids = '', @ViewerId() viewerId?: string): Promise<PostResponseDto[]> {
    return this.postsService.findMany(
      ids.split(',').map((id) => id.trim()).filter(Boolean),
      viewerId,
    );
  }

  @Get('activity/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Publicaciones propias con comentarios o reacciones de otras personas que aún no viste',
  })
  @ApiResponse({ status: 200, type: [OwnPostActivityDto] })
  myActivity(@CurrentUser() user: AuthUser): Promise<OwnPostActivityDto[]> {
    return this.postsService.ownActivity(user.userId);
  }

  @Get('comments/by-author/:authorId')
  @ApiOperation({ summary: 'Comentarios de una persona, con la publicación comentada como contexto' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: [CommentWithContextDto] })
  commentsByAuthor(
    @Param('authorId') authorId: string,
    @Query('limit') limit?: string,
  ): Promise<CommentWithContextDto[]> {
    return this.postsService.commentsByAuthor(authorId, limit ? Number(limit) || 30 : 30);
  }

  @Post(':id/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar como vista la actividad actual de una publicación propia' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'No eres el autor' })
  markSeen(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.postsService.markSeen(user, id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener una publicación' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  findOne(@Param('id') id: string, @ViewerId() viewerId?: string): Promise<PostResponseDto> {
    return this.postsService.findOne(id, viewerId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar una publicación propia' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @ApiResponse({ status: 403, description: 'No eres el autor' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.postsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar una publicación (autor o ADMIN)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'No eres el autor ni ADMIN' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.postsService.remove(user, id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Comentar una publicación' })
  @ApiResponse({ status: 201, type: CommentResponseDto })
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.postsService.addComment(user.userId, id, dto);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Listar comentarios de una publicación' })
  @ApiResponse({ status: 200, type: [CommentResponseDto] })
  listComments(@Param('id') id: string): Promise<CommentResponseDto[]> {
    return this.postsService.listComments(id);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar un comentario (autor o ADMIN)' })
  @ApiResponse({ status: 204 })
  removeComment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.postsService.removeComment(user, id, commentId);
  }

  @Put(':id/reactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reaccionar a una publicación (crea o cambia tu reacción)',
  })
  @ApiResponse({ status: 200, type: PostResponseDto })
  react(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ): Promise<PostResponseDto> {
    return this.postsService.react(user.userId, id, dto.type);
  }

  @Delete(':id/reactions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quitar tu reacción de una publicación' })
  @ApiResponse({ status: 204 })
  removeReaction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.postsService.removeReaction(user.userId, id);
  }
}
