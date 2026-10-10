import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum PostType {
  POST = 'POST',
  TWEET = 'TWEET',
  OPINION = 'OPINION',
}

@Schema({ timestamps: true, collection: 'posts' })
export class Post {
  @Prop({ required: true, index: true })
  authorId: string;

  @Prop({ required: true, enum: PostType })
  type: PostType;

  @Prop()
  title?: string;

  @Prop({ required: true })
  content: string;

  // Hashtags normalizados (minúsculas, sin tildes) extraídos del título y el texto.
  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  // Cuánta actividad de otras personas (comentarios y reacciones) ya vio el
  // autor. Lo que supere esto es "actividad nueva en tu publicación".
  @Prop({ default: 0 })
  ownerSeenComments: number;

  @Prop({ default: 0 })
  ownerSeenReactions: number;

  createdAt: Date;
  updatedAt: Date;
}

export type PostDocument = HydratedDocument<Post>;
export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ createdAt: -1 });
