import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import {
  ChatService,
  conversationIdFor,
  REQUEST_MESSAGE_LIMIT,
} from './chat.service';
import { Message } from './schemas/message.schema';
import { AcceptedContact } from './schemas/accepted-contact.schema';
import { UsersClient } from './users.client';

describe('ChatService', () => {
  let service: ChatService;
  let messageModel: Record<string, jest.Mock>;
  let acceptedModel: Record<string, jest.Mock>;
  let usersClient: { assertUserExists: jest.Mock; isFollowing: jest.Mock };

  beforeEach(() => {
    messageModel = {
      create: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
      exists: jest.fn().mockResolvedValue(null),
    };
    acceptedModel = {
      find: jest.fn().mockReturnValue({ lean: () => Promise.resolve([]) }),
      updateOne: jest.fn().mockResolvedValue({}),
      exists: jest.fn().mockResolvedValue(null),
    };
    usersClient = {
      assertUserExists: jest.fn().mockResolvedValue(undefined),
      isFollowing: jest.fn().mockResolvedValue(false),
    };

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
    describe('límite de solicitudes', () => {
      const doc = {
        _id: new Types.ObjectId(),
        conversationId: 'a:b',
        senderId: 'b',
        recipientId: 'a',
        content: 'hola',
        readAt: null,
        createdAt: new Date(),
      };
      beforeEach(() => {
        messageModel.create.mockResolvedValue({ toObject: () => doc });
      });

      it('deja enviar mientras no se llegue al tope sin consultar nada más', async () => {
        messageModel.countDocuments.mockResolvedValue(
          REQUEST_MESSAGE_LIMIT - 1,
        );

        await service.sendMessage('b', 'a', 'hola');

        expect(messageModel.exists).not.toHaveBeenCalled();
        expect(usersClient.isFollowing).not.toHaveBeenCalled();
      });

      it('bloquea al llegar al tope si el destinatario no aceptó', async () => {
        messageModel.countDocuments.mockResolvedValue(REQUEST_MESSAGE_LIMIT);

        await expect(service.sendMessage('b', 'a', 'hola')).rejects.toThrow(
          ForbiddenException,
        );
        expect(usersClient.isFollowing).toHaveBeenCalledWith('a', 'b');
        expect(messageModel.create).not.toHaveBeenCalled();
      });

      it('no limita si el destinatario ya respondió', async () => {
        messageModel.countDocuments.mockResolvedValue(10);
        messageModel.exists.mockResolvedValue({ _id: 'x' });

        await service.sendMessage('b', 'a', 'hola');

        expect(messageModel.create).toHaveBeenCalled();
      });

      it('no limita si el destinatario aceptó la solicitud', async () => {
        messageModel.countDocuments.mockResolvedValue(10);
        acceptedModel.exists.mockResolvedValue({ _id: 'x' });

        await service.sendMessage('b', 'a', 'hola');

        expect(acceptedModel.exists).toHaveBeenCalledWith({
          userId: 'a',
          otherUserId: 'b',
        });
        expect(messageModel.create).toHaveBeenCalled();
      });

      it('no limita si el destinatario sigue a quien escribe', async () => {
        messageModel.countDocuments.mockResolvedValue(10);
        usersClient.isFollowing.mockResolvedValue(true);

        await service.sendMessage('b', 'a', 'hola');

        expect(messageModel.create).toHaveBeenCalled();
      });
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
