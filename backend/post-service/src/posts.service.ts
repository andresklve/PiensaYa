import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostType } from './schemas/post.schema';
import { Comment } from './schemas/comment.schema';
import { Reaction, ReactionType } from './schemas/reaction.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PaginatedPostsDto, PostResponseDto } from './dto/post-response.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CommentWithContextDto, OwnPostActivityDto } from './dto/activity.dto';
import { SearchQueryDto, SearchResultDto, TagCountDto } from './dto/search.dto';
import { escapeRegex, extractTags, normalizeQuery } from './hashtags';
import { PostEventsPublisher } from './events/post-events.publisher';
import type { AuthUser } from './strategies/jwt.strategy';

export type { AuthUser };

export const TWEET_MAX_LENGTH = 280;
export const OPINION_MAX_LENGTH = 600;
const EXCERPT_LENGTH = 200;
// Cuántas publicaciones propias recientes se revisan buscando actividad nueva.
const ACTIVITY_SCAN_LIMIT = 100;
export const BATCH_MAX = 50;

type LeanPost = Post & { _id: Types.ObjectId };
type LeanComment = Comment & { _id: Types.ObjectId };

// Búsqueda de texto que ignora tildes: "calculo" encuentra "Cálculo".
function accentInsensitive(text: string): string {
  const classes: Record<string, string> = {
    a: '[aáàâä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôö]', u: '[uúùûü]', n: '[nñ]', c: '[cç]',
  };
  return escapeRegex(text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()).replace(
    /[aeiounc]/g,
    (ch) => classes[ch] ?? ch,
  );
}

@Injectable()
export class PostsService implements OnModuleInit {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectModel(Reaction.name) private readonly reactionModel: Model<Reaction>,
    private readonly events: PostEventsPublisher,
  ) {}

  // Las publicaciones anteriores a los hashtags se indexan una sola vez al arrancar.
  async onModuleInit(): Promise<void> {
    const pending = await this.postModel
      .find({ tags: { $exists: false } }, { title: 1, content: 1 })
      .lean<LeanPost[]>();
    if (pending.length === 0) return;
    await this.postModel.bulkWrite(
      pending.map((p) => ({
        updateOne: { filter: { _id: p._id }, update: { $set: { tags: extractTags(p.title, p.content) } } },
      })),
    );
    this.logger.log(`Hashtags indexados en ${pending.length} publicaciones existentes`);
  }

  async create(authorId: string, dto: CreatePostDto): Promise<PostResponseDto> {
    this.validateContentRules(dto.type, dto.title, dto.content);

    const post = await this.postModel.create({
      authorId,
      type: dto.type,
      title: dto.type === PostType.POST ? dto.title : undefined,
      content: dto.content,
      tags: extractTags(dto.type === PostType.POST ? dto.title : undefined, dto.content),
    });

    this.events.postCreated({
      postId: post._id.toString(),
      authorId,
      type: post.type,
      title: post.title,
      excerpt: post.content.slice(0, EXCERPT_LENGTH),
      createdAt: post.createdAt.toISOString(),
    });

    return this.toPostResponse(post.toObject() as LeanPost, 0, {});
  }

  async findOne(id: string): Promise<PostResponseDto> {
    const post = await this.findPostOrThrow(id);
    const [response] = await this.withCounts([post]);
    return response;
  }

  async list(query: ListPostsQueryDto): Promise<PaginatedPostsDto> {
    const filter: Record<string, unknown> = {};
    if (query.authorId) filter.authorId = query.authorId;
    else if (query.excludeAuthorId) filter.authorId = { $ne: query.excludeAuthorId };
    if (query.tag) filter.tags = normalizeQuery(query.tag);
    if (query.type) filter.type = query.type;

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<LeanPost[]>(),
      this.postModel.countDocuments(filter),
    ]);

    return {
      items: await this.withCounts(posts),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  // Hashtags existentes para autocompletar: primero los que empiezan con lo
  // escrito, luego los que lo contienen; dentro de cada grupo, los más usados.
  async suggestTags(q: string | undefined, limit: number): Promise<TagCountDto[]> {
    const needle = q ? normalizeQuery(q) : '';
    const contains = needle ? { tags: { $regex: escapeRegex(needle) } } : {};
    const rows = await this.postModel.aggregate<{ _id: string; count: number }>([
      { $match: contains },
      { $unwind: '$tags' },
      { $match: contains },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
          lastUsedAt: { $max: '$createdAt' },
        },
      },
      {
        $addFields: {
          prefix: needle ? { $cond: [{ $eq: [{ $indexOfCP: ['$_id', needle] }, 0] }, 1, 0] } : 0,
        },
      },
      { $sort: { prefix: -1, count: -1, lastUsedAt: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r) => ({ tag: r._id, count: r.count }));
  }

  // Buscador general: "calculo" encuentra los hashtags que lo contienen
  // (#calculo2, #calculo1…) y las publicaciones con esos hashtags o con la
  // palabra en el título o el texto, sin importar mayúsculas ni tildes.
  async search(query: SearchQueryDto): Promise<SearchResultDto> {
    const needle = normalizeQuery(query.q);
    const words = query.q.replace(/#/g, ' ').trim();
    if (!needle) return { tags: [], posts: [] };

    const tags = await this.suggestTags(needle, 8);
    const text = { $regex: accentInsensitive(words), $options: 'i' };
    const filter: Record<string, unknown> = {
      $or: [
        ...(tags.length ? [{ tags: { $in: tags.map((t) => t.tag) } }] : []),
        { title: text },
        { content: text },
      ],
    };
    if (query.excludeAuthorId) filter.authorId = { $ne: query.excludeAuthorId };
    if (query.type) filter.type = query.type;

    const posts = await this.postModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(query.limit)
      .lean<LeanPost[]>();
    return { tags, posts: await this.withCounts(posts) };
  }

  // Varias publicaciones en una sola llamada, en el orden pedido (las que no
  // existen se omiten). Evita N peticiones al hidratar un feed.
  async findMany(ids: string[]): Promise<PostResponseDto[]> {
    const valid = [...new Set(ids)].filter((id) => Types.ObjectId.isValid(id)).slice(0, BATCH_MAX);
    if (valid.length === 0) return [];
    const posts = await this.postModel
      .find({ _id: { $in: valid.map((id) => new Types.ObjectId(id)) } })
      .lean<LeanPost[]>();
    const byId = new Map((await this.withCounts(posts)).map((p) => [p.id, p]));
    return valid.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }

  // Publicaciones propias con comentarios o reacciones de OTRAS personas que
  // el autor todavía no vio. Lo propio (comentar o reaccionar a lo tuyo) no cuenta.
  async ownActivity(userId: string): Promise<OwnPostActivityDto[]> {
    const own = await this.postModel
      .find({ authorId: userId })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_SCAN_LIMIT)
      .lean<LeanPost[]>();
    if (own.length === 0) return [];

    const others = await this.othersActivity(own.map((p) => p._id), userId);
    const pending = own
      .map((post) => {
        const a = others.get(post._id.toString());
        return {
          post,
          newComments: Math.max(0, (a?.comments ?? 0) - (post.ownerSeenComments ?? 0)),
          newReactions: Math.max(0, (a?.reactions ?? 0) - (post.ownerSeenReactions ?? 0)),
          lastActivityAt: a?.lastAt ?? post.createdAt,
        };
      })
      .filter((x) => x.newComments > 0 || x.newReactions > 0)
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

    const responses = new Map(
      (await this.withCounts(pending.map((x) => x.post))).map((r) => [r.id, r]),
    );
    return pending.map((x) => ({
      post: responses.get(x.post._id.toString())!,
      newComments: x.newComments,
      newReactions: x.newReactions,
      lastActivityAt: x.lastActivityAt,
    }));
  }

  // El autor vio su publicación: se guarda la actividad actual como "vista".
  async markSeen(user: AuthUser, id: string): Promise<void> {
    const post = await this.findPostOrThrow(id);
    if (post.authorId !== user.userId) {
      throw new ForbiddenException('Solo el autor puede marcar su publicación como vista');
    }
    const a = (await this.othersActivity([post._id], user.userId)).get(post._id.toString());
    await this.postModel.updateOne(
      { _id: post._id },
      { $set: { ownerSeenComments: a?.comments ?? 0, ownerSeenReactions: a?.reactions ?? 0 } },
    );
  }

  // Comentarios de una persona con el contexto de la publicación comentada,
  // para leerlos fuera de su hilo (pestaña "Comentarios" del perfil).
  async commentsByAuthor(authorId: string, limit = 30): Promise<CommentWithContextDto[]> {
    const comments = await this.commentModel
      .find({ authorId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .lean<LeanComment[]>();
    const posts = await this.postModel
      .find({ _id: { $in: [...new Set(comments.map((c) => c.postId.toString()))].map((id) => new Types.ObjectId(id)) } })
      .lean<LeanPost[]>();
    const byId = new Map(posts.map((p) => [p._id.toString(), p]));

    return comments.map((c) => {
      const post = byId.get(c.postId.toString());
      return {
        comment: this.toCommentResponse(c),
        post: post
          ? {
              id: post._id.toString(),
              authorId: post.authorId,
              type: post.type,
              title: post.title,
              excerpt: post.content.slice(0, EXCERPT_LENGTH),
            }
          : null,
      };
    });
  }

  private async othersActivity(
    postIds: Types.ObjectId[],
    ownerId: string,
  ): Promise<Map<string, { comments: number; reactions: number; lastAt: Date }>> {
    const [comments, reactions] = await Promise.all([
      this.commentModel.aggregate<{ _id: Types.ObjectId; count: number; lastAt: Date }>([
        { $match: { postId: { $in: postIds }, authorId: { $ne: ownerId } } },
        { $group: { _id: '$postId', count: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
      ]),
      this.reactionModel.aggregate<{ _id: Types.ObjectId; count: number; lastAt: Date }>([
        { $match: { postId: { $in: postIds }, userId: { $ne: ownerId } } },
        { $group: { _id: '$postId', count: { $sum: 1 }, lastAt: { $max: '$updatedAt' } } },
      ]),
    ]);

    const result = new Map<string, { comments: number; reactions: number; lastAt: Date }>();
    const entry = (id: Types.ObjectId) => {
      const key = id.toString();
      if (!result.has(key)) result.set(key, { comments: 0, reactions: 0, lastAt: new Date(0) });
      return result.get(key)!;
    };
    for (const c of comments) {
      const e = entry(c._id);
      e.comments = c.count;
      if (c.lastAt > e.lastAt) e.lastAt = c.lastAt;
    }
    for (const r of reactions) {
      const e = entry(r._id);
      e.reactions = r.count;
      if (r.lastAt && r.lastAt > e.lastAt) e.lastAt = r.lastAt;
    }
    return result;
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    const post = await this.findPostOrThrow(id);

    if (post.authorId !== user.userId) {
      throw new ForbiddenException('Solo el autor puede editar esta publicación');
    }

    const title = dto.title ?? post.title;
    const content = dto.content ?? post.content;
    this.validateContentRules(post.type, title, content);

    const updated = await this.postModel
      .findByIdAndUpdate(
        post._id,
        {
          title: post.type === PostType.POST ? title : undefined,
          content,
          tags: extractTags(post.type === PostType.POST ? title : undefined, content),
        },
        { new: true },
      )
      .lean<LeanPost>();

    const [response] = await this.withCounts([updated!]);
    return response;
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const post = await this.findPostOrThrow(id);

    if (post.authorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo el autor o un administrador pueden eliminar esta publicación',
      );
    }

    await Promise.all([
      this.postModel.deleteOne({ _id: post._id }),
      this.commentModel.deleteMany({ postId: post._id }),
      this.reactionModel.deleteMany({ postId: post._id }),
    ]);

    this.events.postDeleted({
      postId: post._id.toString(),
      authorId: post.authorId,
    });
  }

  async addComment(
    authorId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const post = await this.findPostOrThrow(postId);

    const comment = await this.commentModel.create({
      postId: post._id,
      authorId,
      content: dto.content,
    });

    return this.toCommentResponse(comment.toObject() as LeanComment);
  }

  async listComments(postId: string): Promise<CommentResponseDto[]> {
    const post = await this.findPostOrThrow(postId);

    const comments = await this.commentModel
      .find({ postId: post._id })
      .sort({ createdAt: 1 })
      .lean<LeanComment[]>();

    return comments.map((c) => this.toCommentResponse(c));
  }

  async removeComment(
    user: AuthUser,
    postId: string,
    commentId: string,
  ): Promise<void> {
    const post = await this.findPostOrThrow(postId);
    const comment = await this.commentModel
      .findOne({ _id: this.toObjectId(commentId), postId: post._id })
      .lean<LeanComment>();

    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    if (comment.authorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo el autor o un administrador pueden eliminar este comentario',
      );
    }

    await this.commentModel.deleteOne({ _id: comment._id });
  }

  async react(
    userId: string,
    postId: string,
    type: ReactionType,
  ): Promise<PostResponseDto> {
    const post = await this.findPostOrThrow(postId);

    await this.reactionModel.updateOne(
      { postId: post._id, userId },
      { $set: { type } },
      { upsert: true },
    );

    const [response] = await this.withCounts([post]);
    return response;
  }

  async removeReaction(userId: string, postId: string): Promise<void> {
    const post = await this.findPostOrThrow(postId);
    const result = await this.reactionModel.deleteOne({
      postId: post._id,
      userId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('No has reaccionado a esta publicación');
    }
  }

  private validateContentRules(
    type: PostType,
    title: string | undefined,
    content: string,
  ): void {
    if (type === PostType.TWEET && content.length > TWEET_MAX_LENGTH) {
      throw new BadRequestException(
        `Un tweet no puede superar los ${TWEET_MAX_LENGTH} caracteres`,
      );
    }

    if (type === PostType.OPINION && content.length > OPINION_MAX_LENGTH) {
      throw new BadRequestException(
        `Una opinión no puede superar los ${OPINION_MAX_LENGTH} caracteres`,
      );
    }

    if (type === PostType.POST && !title?.trim()) {
      throw new BadRequestException('Un artículo (POST) requiere un título');
    }
  }

  private async findPostOrThrow(id: string): Promise<LeanPost> {
    const post = await this.postModel
      .findById(this.toObjectId(id))
      .lean<LeanPost>();

    if (!post) {
      throw new NotFoundException('Publicación no encontrada');
    }

    return post;
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Recurso no encontrado');
    }
    return new Types.ObjectId(id);
  }

  private async withCounts(posts: LeanPost[]): Promise<PostResponseDto[]> {
    if (posts.length === 0) return [];

    const ids = posts.map((p) => p._id);

    const [commentCounts, reactionCounts] = await Promise.all([
      this.commentModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { postId: { $in: ids } } },
        { $group: { _id: '$postId', count: { $sum: 1 } } },
      ]),
      this.reactionModel.aggregate<{
        _id: { postId: Types.ObjectId; type: ReactionType };
        count: number;
      }>([
        { $match: { postId: { $in: ids } } },
        {
          $group: {
            _id: { postId: '$postId', type: '$type' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const commentsByPost = new Map(
      commentCounts.map((c) => [c._id.toString(), c.count]),
    );
    const reactionsByPost = new Map<
      string,
      Partial<Record<ReactionType, number>>
    >();
    for (const r of reactionCounts) {
      const key = r._id.postId.toString();
      const entry = reactionsByPost.get(key) ?? {};
      entry[r._id.type] = r.count;
      reactionsByPost.set(key, entry);
    }

    return posts.map((p) => {
      const key = p._id.toString();
      return this.toPostResponse(
        p,
        commentsByPost.get(key) ?? 0,
        reactionsByPost.get(key) ?? {},
      );
    });
  }

  private toPostResponse(
    post: LeanPost,
    commentsCount: number,
    reactions: Partial<Record<ReactionType, number>>,
  ): PostResponseDto {
    return {
      id: post._id.toString(),
      authorId: post.authorId,
      type: post.type,
      title: post.title,
      content: post.content,
      tags: post.tags ?? [],
      commentsCount,
      reactions,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private toCommentResponse(comment: LeanComment): CommentResponseDto {
    return {
      id: comment._id.toString(),
      postId: comment.postId.toString(),
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt,
    };
  }
}
