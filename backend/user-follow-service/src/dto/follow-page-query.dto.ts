import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { FollowerItemDto } from './follower-item.dto';

// Paginación opcional de seguidores/seguidos. Sin limit se devuelve la lista
// completa: el Feed Service (fan-out) y el "¿lo sigo?" del frontend la necesitan.
export class FollowPageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class IsFollowingResponseDto {
  @ApiProperty()
  following: boolean;
}

export class SuggestionQueryDto {
  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 5;
}

export class SuggestionDto extends FollowerItemDto {
  @ApiProperty({
    description: 'Cuántas de las personas que sigues también siguen a esta',
  })
  mutualCount: number;
}
