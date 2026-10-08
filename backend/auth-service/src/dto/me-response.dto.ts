import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class MeResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ enum: Role })
  role: Role;
}
