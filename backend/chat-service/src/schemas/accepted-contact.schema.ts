import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Solicitud de mensaje aceptada: userId aceptó los mensajes de otherUserId.
// Responder también cuenta como aceptar (ver listConversations), así que solo
// se guarda cuando alguien acepta sin haber escrito todavía.
@Schema({ timestamps: true, collection: 'accepted_contacts' })
export class AcceptedContact {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  otherUserId: string;
}

export type AcceptedContactDocument = HydratedDocument<AcceptedContact>;
export const AcceptedContactSchema =
  SchemaFactory.createForClass(AcceptedContact);
AcceptedContactSchema.index({ userId: 1, otherUserId: 1 }, { unique: true });
