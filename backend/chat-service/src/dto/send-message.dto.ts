import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const MESSAGE_MAX_LENGTH = 2000;

export class SendMessageDto {
  @ApiProperty({ example: 'Hola! viste el último post?' })
  @IsNotEmpty({ message: 'El mensaje no puede estar vacío' })
  @IsString()
  @MaxLength(MESSAGE_MAX_LENGTH, {
    message: `El mensaje no puede superar los ${MESSAGE_MAX_LENGTH} caracteres`,
  })
  content: string;
}
