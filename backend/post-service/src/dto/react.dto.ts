import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ReactionType } from '../schemas/reaction.schema';

export class ReactDto {
  @ApiProperty({ enum: ReactionType, example: ReactionType.LIKE })
  @IsEnum(ReactionType, {
    message: `type debe ser uno de: ${Object.values(ReactionType).join(', ')}`,
  })
  type: ReactionType;
}
