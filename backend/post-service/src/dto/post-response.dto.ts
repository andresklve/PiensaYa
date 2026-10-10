import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostType } from '../schemas/post.schema';
import { ReactionType } from '../schemas/reaction.schema';

export class PostResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  authorId: string;

  @ApiProperty({ enum: PostType })
  type: PostType;

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [String], example: ['calculo2'], description: 'Hashtags normalizados' })
  tags: string[];

  @ApiProperty()
  commentsCount: number;

  @ApiProperty({
    example: { LIKE: 3, FELIZ: 1 },
    description: 'Conteo de reacciones por tipo',
  })
  reactions: Partial<Record<ReactionType, number>>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedPostsDto {
  @ApiProperty({ type: [PostResponseDto] })
  items: PostResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;
}
