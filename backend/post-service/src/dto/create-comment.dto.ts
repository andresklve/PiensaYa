import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'El comentario no puede estar vacío' })
  @IsString()
  @MaxLength(1000, { message: 'El comentario no puede superar los 1000 caracteres' })
  content: string;
}
