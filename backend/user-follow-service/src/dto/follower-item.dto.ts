import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FollowerItemDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional()
  avatarUrl: string | null;
}
