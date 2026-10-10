import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PostType } from '../schemas/post.schema';

export class ListPostsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Excluye las publicaciones de este autor (p. ej. las propias en "Para ti")',
  })
  @IsOptional()
  @IsString()
  excludeAuthorId?: string;

  @ApiPropertyOptional({ description: 'Solo publicaciones con este hashtag (con o sin #)' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
