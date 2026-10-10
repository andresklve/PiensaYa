import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional()
  authorUsername?: string;

  @ApiProperty({ enum: ['POST', 'TWEET', 'OPINION'] })
  type: 'POST' | 'TWEET' | 'OPINION';

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

export class ForYouQueryDto {
  @ApiPropertyOptional({ enum: ['POST', 'TWEET', 'OPINION'] })
  @IsOptional()
  @IsIn(['POST', 'TWEET', 'OPINION'])
  type?: 'POST' | 'TWEET' | 'OPINION';

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 30;
}

export class ForYouItemDto {
  @ApiProperty() id: string;
  @ApiProperty() authorId: string;
  @ApiProperty({ enum: ['POST', 'TWEET', 'OPINION'] }) type: 'POST' | 'TWEET' | 'OPINION';
  @ApiPropertyOptional() title?: string;
  @ApiProperty() content: string;
  @ApiPropertyOptional({ type: [String] }) tags?: string[];
  @ApiProperty() commentsCount: number;
  @ApiProperty({ type: Object }) reactions: Record<string, number>;
  @ApiPropertyOptional({ nullable: true, description: 'Tu reacción (la calcula el Post Service)' })
  myReaction?: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;

  @ApiProperty({
    enum: ['following', 'discovery'],
    description: 'following = de alguien que sigues; discovery = sugerido para descubrir',
  })
  reason: 'following' | 'discovery';
}

export class ForYouDto {
  @ApiProperty({ type: [ForYouItemDto] })
  items: ForYouItemDto[];
}
