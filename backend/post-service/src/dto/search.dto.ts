import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PostType } from '../schemas/post.schema';
import { PostResponseDto } from './post-response.dto';

export class TagCountDto {
  @ApiProperty({ example: 'calculo2' })
  tag: string;

  @ApiProperty({ description: 'Cuántas publicaciones lo usan' })
  count: number;
}

export class SuggestQueryDto {
  @ApiPropertyOptional({ description: 'Lo que lleva escrito (sin #). Vacío = los más usados' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  q?: string;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 8;
}

export class SearchQueryDto {
  @ApiProperty({ example: 'calculo' })
  @IsString()
  @MaxLength(80)
  q: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excludeAuthorId?: string;

  @ApiPropertyOptional({ enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class SearchResultDto {
  @ApiProperty({ type: [TagCountDto], description: 'Hashtags que coinciden con la búsqueda' })
  tags: TagCountDto[];

  @ApiProperty({ type: [PostResponseDto] })
  posts: PostResponseDto[];
}
