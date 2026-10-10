import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from './schemas/message.schema';
import { AcceptedContact } from './schemas/accepted-contact.schema';
import {
  ConversationSummaryDto,
  MessageResponseDto,
} from './dto/message-response.dto';
import { MESSAGE_MAX_LENGTH } from './dto/send-message.dto';
import { UsersClient } from './users.client';

type LeanMessage = Message & { _id: Types.ObjectId };

export function conversationIdFor(userA: string, userB: string): string {
  return [userA, userB].sort().join(':');
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(AcceptedContact.name)
    private readonly acceptedModel: Model<AcceptedContact>,
    private readonly usersClient: UsersClient,
  ) {}

  async sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<MessageResponseDto> {
    const text = content?.trim();

    if (!recipientId) {
      throw new BadRequestException('Falta el destinatario');
    }
    if (senderId === recipientId) {
      throw new BadRequestException('No puedes enviarte mensajes a ti mismo');
    }
    if (!text) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }
    if (text.length > MESSAGE_MAX_LENGTH) {
      throw new BadRequestException(
        `El mensaje no puede superar los ${MESSAGE_MAX_LENGTH} caracteres`,
      );
    }

    await this.usersClient.assertUserExists(recipientId);

    const message = await this.messageModel.create({
      conversationId: conversationIdFor(senderId, recipientId),
      senderId,
      recipientId,
      content: text,
    });

    return this.toResponse(message.toObject() as LeanMessage);
  }

  async getHistory(
    userId: string,
    otherUserId: string,
    limit: number,
    before?: string,
  ): Promise<MessageResponseDto[]> {
    const filter: Record<string, unknown> = {
      conversationId: conversationIdFor(userId, otherUserId),
    };
    if (before) filter.createdAt = { $lt: new Date(before) };

    const messages = await this.messageModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<LeanMessage[]>();

    return messages.reverse().map((m) => this.toResponse(m));
  }

  async listConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const rows = await this.messageModel.aggregate<{
      _id: string;
      lastMessage: LeanMessage;
      unreadCount: number;
      sentByMe: boolean;
    }>([
      { $match: { $or: [{ senderId: userId }, { recipientId: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipientId', userId] },
                    { $eq: ['$readAt', null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          sentByMe: { $max: { $eq: ['$senderId', userId] } },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);

    const otherIds = rows.map((row) =>
      row.lastMessage.senderId === userId
        ? row.lastMessage.recipientId
        : row.lastMessage.senderId,
    );
    const acceptedRows = otherIds.length
      ? await this.acceptedModel
          .find({ userId, otherUserId: { $in: otherIds } }, { otherUserId: 1 })
          .lean()
      : [];
    const acceptedIds = new Set(acceptedRows.map((a) => a.otherUserId));

    return rows.map((row, i) => ({
      otherUserId: otherIds[i],
      lastMessage: this.toResponse(row.lastMessage),
      unreadCount: row.unreadCount,
      accepted: row.sentByMe || acceptedIds.has(otherIds[i]),
    }));
  }

  // Acepta la solicitud de mensajes de otherUserId (idempotente).
  async acceptConversation(userId: string, otherUserId: string): Promise<void> {
    if (userId === otherUserId) {
      throw new BadRequestException('No puedes aceptarte a ti mismo');
    }
    await this.acceptedModel.updateOne(
      { userId, otherUserId },
      { $setOnInsert: { userId, otherUserId } },
      { upsert: true },
    );
  }

  async markAsRead(userId: string, otherUserId: string): Promise<number> {
    const result = await this.messageModel.updateMany(
      {
        conversationId: conversationIdFor(userId, otherUserId),
        recipientId: userId,
        readAt: null,
      },
      { $set: { readAt: new Date() } },
    );
    return result.modifiedCount;
  }

  private toResponse(message: LeanMessage): MessageResponseDto {
    return {
      id: message._id.toString(),
      conversationId: message.conversationId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
      readAt: message.readAt ?? null,
      createdAt: message.createdAt,
    };
  }
}
