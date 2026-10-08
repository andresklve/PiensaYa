import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum ReactionType {
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE',
  FELIZ = 'FELIZ',
  TRISTE = 'TRISTE',
  ENOJADO = 'ENOJADO',
  INTERESANTE = 'INTERESANTE',
}

@Schema({ timestamps: true, collection: 'reactions' })
export class Reaction {
  @Prop({ type: Types.ObjectId, required: true })
  postId: Types.ObjectId;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: ReactionType })
  type: ReactionType;
}

export type ReactionDocument = HydratedDocument<Reaction>;
export const ReactionSchema = SchemaFactory.createForClass(Reaction);
ReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });
