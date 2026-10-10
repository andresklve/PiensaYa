import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PostType } from '../schemas/post.schema';

export class CreatePostDto {
  @ApiProperty({ enum: PostType, example: PostType.TWEET })
  @IsEnum(PostType, { message: 'type debe ser POST, TWEET u OPINION' })
  type: PostType;

  @ApiPropertyOptional({ description: 'Obligatorio cuando type es POST' })
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'El título no puede superar los 150 caracteres' })
  title?: string;

  @ApiProperty({ description: 'Máximo 280 caracteres si es TWEET y 600 si es OPINION' })
  @IsNotEmpty({ message: 'El contenido es obligatorio' })
  @IsString()
  content: string;
}
