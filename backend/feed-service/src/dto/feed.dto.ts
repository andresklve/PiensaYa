import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FeedQueryDto {
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

export class FeedItemDto {
  @ApiProperty()
  postId: string;

  @ApiProperty()
  authorId: string;

  @ApiPropertyOptional()
  authorName?: string;

  @ApiProperty({ enum: ['POST', 'TWEET'] })
  type: 'POST' | 'TWEET';

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  excerpt: string;

  @ApiProperty()
  createdAt: string;
}

export class FeedPageDto {
  @ApiProperty({ type: [FeedItemDto] })
  items: FeedItemDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty({ description: 'Entradas en el feed (incluye las de posts ya eliminados que aún no se limpiaron)' })
  total: number;
}
