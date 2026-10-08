import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { normalizeUsername } from './username';

export class LoginDto {
  @ApiProperty({ example: 'carlos_andres' })
  @Transform(({ value }) => normalizeUsername(value))
  @IsString({ message: 'El usuario debe ser texto' })
  @IsNotEmpty({ message: 'El usuario es obligatorio' })
  username: string;

  @ApiProperty({ example: 'Contrasena123' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;
}
