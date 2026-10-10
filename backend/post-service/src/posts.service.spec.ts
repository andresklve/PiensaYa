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
      find: jest.fn().mockReturnValue(lean([])),
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

    it('rechaza una opinión de más de 600 caracteres', async () => {
      await expect(
        service.create(author.userId, {
          type: PostType.OPINION,
          content: 'a'.repeat(601),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('acepta una opinión más larga que un tweet', async () => {
      const created = { ...existingPost, toObject: () => existingPost };
      postModel.create.mockResolvedValue(created);

      await service.create(author.userId, {
        type: PostType.OPINION,
        content: 'a'.repeat(450),
      });

      expect(postModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: PostType.OPINION, title: undefined }),
      );
    });

    it('guarda los hashtags normalizados del título y el texto', async () => {
      const created = { ...existingPost, toObject: () => existingPost };
      postModel.create.mockResolvedValue(created);

      await service.create(author.userId, {
        type: PostType.POST,
        title: 'Regla de la cadena #Cálculo2',
        content: 'Explicación paso a paso. #derivadas',
      });

      expect(postModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['calculo2', 'derivadas'] }),
      );
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

    it('incluye la reacción de quien consulta', async () => {
      postModel.findById.mockReturnValue(lean(existingPost));
      reactionModel.find.mockReturnValue(lean([{ postId, type: ReactionType.FELIZ }]));

      const result = await service.findOne(postId.toString(), other.userId);

      expect(reactionModel.find).toHaveBeenCalledWith(
        { postId: { $in: [postId] }, userId: other.userId },
        { postId: 1, type: 1 },
      );
      expect(result.myReaction).toBe(ReactionType.FELIZ);
    });

    it('sin usuario devuelve myReaction null y no consulta reacciones propias', async () => {
      postModel.findById.mockReturnValue(lean(existingPost));

      const result = await service.findOne(postId.toString());

      expect(reactionModel.find).not.toHaveBeenCalled();
      expect(result.myReaction).toBeNull();
    });
  });

  describe('react', () => {
    it('hace upsert de la reacción del usuario y la devuelve como propia', async () => {
      postModel.findById.mockReturnValue(lean(existingPost));
      reactionModel.find.mockReturnValue(lean([{ postId, type: ReactionType.LIKE }]));

      const result = await service.react(other.userId, postId.toString(), ReactionType.LIKE);

      expect(reactionModel.updateOne).toHaveBeenCalledWith(
        { postId, userId: other.userId },
        { $set: { type: ReactionType.LIKE } },
        { upsert: true },
      );
      expect(result.myReaction).toBe(ReactionType.LIKE);
    });
  });

  describe('list', () => {
    it('excluye al autor indicado en excludeAuthorId', async () => {
      const chain = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnValue(lean([])) };
      postModel.find = jest.fn().mockReturnValue(chain);
      postModel.countDocuments = jest.fn().mockResolvedValue(0);

      await service.list({ excludeAuthorId: author.userId, page: 1, limit: 20 });

      expect(postModel.find).toHaveBeenCalledWith({ authorId: { $ne: author.userId } });
    });
  });

  describe('search', () => {
    it('busca por hashtags que contienen la palabra y por texto sin tildes', async () => {
      postModel.aggregate = jest.fn().mockResolvedValue([{ _id: 'calculo2', count: 3 }]);
      const chain = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnValue(lean([])) };
      postModel.find = jest.fn().mockReturnValue(chain);

      const result = await service.search({ q: 'Cálculo', excludeAuthorId: 'yo', limit: 20 });

      expect(result.tags).toEqual([{ tag: 'calculo2', count: 3 }]);
      const filter = postModel.find.mock.calls[0][0];
      expect(filter.authorId).toEqual({ $ne: 'yo' });
      expect(filter.$or[0]).toEqual({ tags: { $in: ['calculo2'] } });
      const regex = new RegExp(filter.$or[1].title.$regex, 'i');
      expect(regex.test('Repaso de cálculo integral')).toBe(true);
      expect(regex.test('Calculo')).toBe(true);
    });

    it('una búsqueda vacía no consulta nada', async () => {
      postModel.aggregate = jest.fn();
      await expect(service.search({ q: '  # ', limit: 20 })).resolves.toEqual({ tags: [], posts: [] });
      expect(postModel.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('ownActivity', () => {
    const findOwn = (posts: unknown[]) => {
      postModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue(lean(posts)) }),
      });
    };

    it('no devuelve publicaciones sin actividad de otras personas', async () => {
      findOwn([{ ...existingPost, ownerSeenComments: 0, ownerSeenReactions: 0 }]);

      await expect(service.ownActivity(author.userId)).resolves.toEqual([]);
      // La actividad propia se excluye en la consulta misma.
      expect(commentModel.aggregate.mock.calls[0][0][0].$match.authorId).toEqual({ $ne: author.userId });
      expect(reactionModel.aggregate.mock.calls[0][0][0].$match.userId).toEqual({ $ne: author.userId });
    });

    it('devuelve solo lo nuevo respecto a lo ya visto', async () => {
      findOwn([{ ...existingPost, ownerSeenComments: 1, ownerSeenReactions: 2 }]);
      const lastAt = new Date();
      commentModel.aggregate.mockResolvedValueOnce([{ _id: postId, count: 3, lastAt }]);
      reactionModel.aggregate.mockResolvedValueOnce([{ _id: postId, count: 2, lastAt }]);

      const [item] = await service.ownActivity(author.userId);

      expect(item.post.id).toBe(postId.toString());
      expect(item.newComments).toBe(2);
      expect(item.newReactions).toBe(0);
    });

    it('oculta la publicación cuando toda la actividad ya fue vista', async () => {
      findOwn([{ ...existingPost, ownerSeenComments: 3, ownerSeenReactions: 2 }]);
      commentModel.aggregate.mockResolvedValueOnce([{ _id: postId, count: 3, lastAt: new Date() }]);
      reactionModel.aggregate.mockResolvedValueOnce([{ _id: postId, count: 2, lastAt: new Date() }]);

      await expect(service.ownActivity(author.userId)).resolves.toEqual([]);
    });
  });

  describe('markSeen', () => {
    it('solo el autor puede marcar como vista', async () => {
      postModel.findById.mockReturnValue(lean(existingPost));
      await expect(service.markSeen(other, postId.toString())).rejects.toThrow(ForbiddenException);
    });

    it('guarda la actividad actual de otras personas como vista', async () => {
      postModel.findById.mockReturnValue(lean(existingPost));
      postModel.updateOne = jest.fn().mockResolvedValue({});
      commentModel.aggregate.mockResolvedValueOnce([{ _id: postId, count: 4, lastAt: new Date() }]);
      reactionModel.aggregate.mockResolvedValueOnce([{ _id: postId, count: 1, lastAt: new Date() }]);

      await service.markSeen(author, postId.toString());

      expect(postModel.updateOne).toHaveBeenCalledWith(
        { _id: postId },
        { $set: { ownerSeenComments: 4, ownerSeenReactions: 1 } },
      );
    });
  });
});
