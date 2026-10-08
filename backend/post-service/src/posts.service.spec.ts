import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { AuthUser, PostsService } from './posts.service';
import { Post, PostType } from './schemas/post.schema';
import { Comment } from './schemas/comment.schema';
import { Reaction, ReactionType } from './schemas/reaction.schema';
import { PostEventsPublisher } from './events/post-events.publisher';

const lean = <T>(value: T) => ({ lean: jest.fn().mockResolvedValue(value) });

describe('PostsService', () => {
  let service: PostsService;
  let postModel: Record<string, jest.Mock>;
  let commentModel: Record<string, jest.Mock>;
  let reactionModel: Record<string, jest.Mock>;
  let events: { postCreated: jest.Mock; postDeleted: jest.Mock };

  const author: AuthUser = { userId: 'author-1', username: 'autor', role: 'USUARIO' };
  const other: AuthUser = { userId: 'other-1', username: 'otro', role: 'USUARIO' };
  const admin: AuthUser = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };

  const postId = new Types.ObjectId();
  const existingPost = {
    _id: postId,
    authorId: author.userId,
    type: PostType.TWEET,
    content: 'hola',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    postModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    commentModel = {
      aggregate: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({}),
    };
    reactionModel = {
      aggregate: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    events = { postCreated: jest.fn(), postDeleted: jest.fn() };

    service = new PostsService(
      postModel as unknown as Model<Post>,
      commentModel as unknown as Model<Comment>,
      reactionModel as unknown as Model<Reaction>,
      events as unknown as PostEventsPublisher,
    );
  });

  describe('create', () => {
    it('rechaza un tweet de más de 280 caracteres', async () => {
      await expect(
        service.create(author.userId, {
          type: PostType.TWEET,
          content: 'a'.repeat(281),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(postModel.create).not.toHaveBeenCalled();
    });

    it('rechaza un artículo sin título', async () => {
      await expect(
        service.create(author.userId, { type: PostType.POST, content: 'texto' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el post y publica el evento PostCreated', async () => {
      const created = { ...existingPost, toObject: () => existingPost };
      postModel.create.mockResolvedValue(created);

      const result = await service.create(author.userId, {
        type: PostType.TWEET,
        content: 'hola',
      });

      expect(result.id).toBe(postId.toString());
      expect(events.postCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: postId.toString(),
          authorId: author.userId,
          excerpt: 'hola',
        }),
      );
    });
  });

  describe('update', () => {
    it('lanza ForbiddenException si no es el autor', async () => {
      postModel.findById.mockReturnValue(lean(existingPost));

      await expect(
        service.update(other, postId.toString(), { content: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('lanza ForbiddenException si no es autor ni admin', async () => {
      postModel.findById.mockReturnValue(lean(existingPost));

      await expect(service.remove(other, postId.toString())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('permite a un ADMIN eliminar y publica PostDeleted', async () => {
      postModel.findById.mockReturnValue(lean(existingPost));

      await service.remove(admin, postId.toString());

      expect(postModel.deleteOne).toHaveBeenCalled();
      expect(commentModel.deleteMany).toHaveBeenCalled();
      expect(events.postDeleted).toHaveBeenCalledWith({
        postId: postId.toString(),
        authorId: author.userId,
      });
    });
  });

  describe('findOne', () => {
    it('lanza NotFoundException con un id inválido', async () => {
      await expect(service.findOne('no-es-un-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('react', () => {
    it('hace upsert de la reacción del usuario', async () => {
      postModel.findById.mockReturnValue(lean(existingPost));

      await service.react(other.userId, postId.toString(), ReactionType.LIKE);

      expect(reactionModel.updateOne).toHaveBeenCalledWith(
        { postId, userId: other.userId },
        { $set: { type: ReactionType.LIKE } },
        { upsert: true },
      );
    });
  });
});
