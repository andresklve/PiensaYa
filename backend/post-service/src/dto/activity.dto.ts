import { ApiProperty } from '@nestjs/swagger';
import { PostResponseDto } from './post-response.dto';
import { PostType } from '../schemas/post.schema';
import { CommentResponseDto } from './comment-response.dto';

export class OwnPostActivityDto {
  @ApiProperty({ type: PostResponseDto })
  post: PostResponseDto;

  @ApiProperty({ description: 'Comentarios de otras personas que el autor aún no vio' })
  newComments: number;

  @ApiProperty({ description: 'Reacciones de otras personas que el autor aún no vio' })
  newReactions: number;

  @ApiProperty()
  lastActivityAt: Date;
}

export class CommentedPostDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  authorId: string;

  @ApiProperty({ enum: PostType })
  type: PostType;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty()
  excerpt: string;
}

export class CommentWithContextDto {
  @ApiProperty({ type: CommentResponseDto })
  comment: CommentResponseDto;

  @ApiProperty({ type: CommentedPostDto, nullable: true, description: 'null si la publicación fue eliminada' })
  post: CommentedPostDto | null;
}
