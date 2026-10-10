import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280, { message: 'La bio no puede superar los 280 caracteres' })
  bio?: string;

  // La foto de perfil y la portada no se editan aquí: se suben como archivo
  // en POST /users/me/avatar y POST /users/me/cover.
}
