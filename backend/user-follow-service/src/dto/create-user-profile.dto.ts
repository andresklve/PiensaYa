import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, Matches } from 'class-validator';

export class CreateUserProfileDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'carlos_andres' })
  @Matches(/^[a-z0-9_.]{3,30}$/, { message: 'username inválido' })
  username: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  firstName: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  lastName: string;
}
