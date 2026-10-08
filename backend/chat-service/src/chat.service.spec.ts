import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { ChatService, conversationIdFor } from './chat.service';
import { Message } from './schemas/message.schema';
import { UsersClient } from './users.client';

describe('ChatService', () => {
  let service: ChatService;
  let messageModel: Record<string, jest.Mock>;
  let usersClient: { assertUserExists: jest.Mock };

  beforeEach(() => {
    messageModel = {
      create: jest.fn(),
      updateMany: jest.fn(),
    };
    usersClient = { assertUserExists: jest.fn().mockResolvedValue(undefined) };

    service = new ChatService(
      messageModel as unknown as Model<Message>,
      usersClient as unknown as UsersClient,
    );
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
