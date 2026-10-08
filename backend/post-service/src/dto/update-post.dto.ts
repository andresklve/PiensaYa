import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'El título no puede superar los 150 caracteres' })
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty({ message: 'El contenido no puede estar vacío' })
  @IsString()
  content?: string;
}
