import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { ChatService, conversationIdFor } from './chat.service';
import { Message } from './schemas/message.schema';
import { AcceptedContact } from './schemas/accepted-contact.schema';
import { UsersClient } from './users.client';

describe('ChatService', () => {
  let service: ChatService;
  let messageModel: Record<string, jest.Mock>;
  let acceptedModel: Record<string, jest.Mock>;
  let usersClient: { assertUserExists: jest.Mock };

  beforeEach(() => {
    messageModel = {
      create: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
    };
    acceptedModel = {
      find: jest.fn().mockReturnValue({ lean: () => Promise.resolve([]) }),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    usersClient = { assertUserExists: jest.fn().mockResolvedValue(undefined) };

    service = new ChatService(
      messageModel as unknown as Model<Message>,
      acceptedModel as unknown as Model<AcceptedContact>,
      usersClient as unknown as UsersClient,
    );
  });

  const lastMessage = (senderId: string, recipientId: string) => ({
    _id: new Types.ObjectId(),
    conversationId: conversationIdFor(senderId, recipientId),
    senderId,
    recipientId,
    content: 'hola',
    readAt: null,
    createdAt: new Date(),
  });

  describe('listConversations', () => {
    it('marca como aceptada la conversación donde ya escribí', async () => {
      messageModel.aggregate.mockResolvedValue([
        {
          _id: 'a:b',
          lastMessage: lastMessage('b', 'a'),
          unreadCount: 1,
          sentByMe: true,
        },
      ]);

      const [conv] = await service.listConversations('a');

      expect(conv.otherUserId).toBe('b');
      expect(conv.accepted).toBe(true);
    });

    it('deja como solicitud a quien me escribió y no acepté', async () => {
      messageModel.aggregate.mockResolvedValue([
        {
          _id: 'a:c',
          lastMessage: lastMessage('c', 'a'),
          unreadCount: 2,
          sentByMe: false,
        },
      ]);

      const [conv] = await service.listConversations('a');

      expect(conv.accepted).toBe(false);
    });

    it('marca como aceptada la solicitud que acepté sin responder', async () => {
      messageModel.aggregate.mockResolvedValue([
        {
          _id: 'a:c',
          lastMessage: lastMessage('c', 'a'),
          unreadCount: 2,
          sentByMe: false,
        },
      ]);
      acceptedModel.find.mockReturnValue({
        lean: () => Promise.resolve([{ otherUserId: 'c' }]),
      });

      const [conv] = await service.listConversations('a');

      expect(acceptedModel.find).toHaveBeenCalledWith(
        { userId: 'a', otherUserId: { $in: ['c'] } },
        expect.anything(),
      );
      expect(conv.accepted).toBe(true);
    });
  });

  describe('acceptConversation', () => {
    it('guarda la aceptación de forma idempotente', async () => {
      await service.acceptConversation('a', 'c');

      expect(acceptedModel.updateOne).toHaveBeenCalledWith(
        { userId: 'a', otherUserId: 'c' },
        expect.anything(),
        { upsert: true },
      );
    });

    it('rechaza aceptarse a uno mismo', async () => {
      await expect(service.acceptConversation('a', 'a')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('conversationIdFor', () => {
    it('genera el mismo id sin importar el orden de los usuarios', () => {
      expect(conversationIdFor('b', 'a')).toBe(conversationIdFor('a', 'b'));
    });
  });

  describe('sendMessage', () => {
    it('rechaza enviarse mensajes a uno mismo', async () => {
      await expect(service.sendMessage('a', 'a', 'hola')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza mensajes vacíos', async () => {
      await expect(service.sendMessage('a', 'b', '   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propaga NotFound si el destinatario no existe', async () => {
      usersClient.assertUserExists.mockRejectedValue(
        new NotFoundException('El destinatario no existe'),
      );

      await expect(service.sendMessage('a', 'zzz', 'hola')).rejects.toThrow(
        NotFoundException,
      );
      expect(messageModel.create).not.toHaveBeenCalled();
    });

    it('guarda el mensaje con el conversationId correcto', async () => {
      const doc = {
        _id: new Types.ObjectId(),
        conversationId: 'a:b',
        senderId: 'b',
        recipientId: 'a',
        content: 'hola',
        readAt: null,
        createdAt: new Date(),
      };
      messageModel.create.mockResolvedValue({ toObject: () => doc });

      const result = await service.sendMessage('b', 'a', '  hola  ');

      expect(messageModel.create).toHaveBeenCalledWith({
        conversationId: 'a:b',
        senderId: 'b',
        recipientId: 'a',
        content: 'hola',
      });
      expect(result.id).toBe(doc._id.toString());
    });
  });

  describe('markAsRead', () => {
    it('solo marca los mensajes recibidos por el usuario', async () => {
      messageModel.updateMany.mockResolvedValue({ modifiedCount: 3 });

      const updated = await service.markAsRead('a', 'b');

      expect(updated).toBe(3);
      expect(messageModel.updateMany).toHaveBeenCalledWith(
        { conversationId: 'a:b', recipientId: 'a', readAt: null },
        expect.anything(),
      );
    });
  });
});
