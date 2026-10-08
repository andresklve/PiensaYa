import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
import { PostEventsPublisher } from './events/post-events.publisher';

export const TWEET_MAX_LENGTH = 280;
const EXCERPT_LENGTH = 200;

export interface AuthUser {
  userId: string;
  email: string;
  role: 'USUARIO' | 'ADMIN';
}

type LeanPost = Post & { _id: Types.ObjectId };
type LeanComment = Comment & { _id: Types.ObjectId };

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectModel(Reaction.name) private readonly reactionModel: Model<Reaction>,
    private readonly events: PostEventsPublisher,
  ) {}

  async create(authorId: string, dto: CreatePostDto): Promise<PostResponseDto> {
    this.validateContentRules(dto.type, dto.title, dto.content);

    const post = await this.postModel.create({
      authorId,
      type: dto.type,
      title: dto.type === PostType.POST ? dto.title : undefined,
      content: dto.content,
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
        { title: post.type === PostType.POST ? title : undefined, content },
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
