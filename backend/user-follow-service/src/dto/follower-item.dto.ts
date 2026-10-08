import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FollowerItemDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional()
  avatarUrl: string | null;
}
