import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export type PostKind = 'POST' | 'TWEET' | 'OPINION';

// Forma de la publicación tal como la expone el Post Service (copia local del contrato).
export interface PostView {
  id: string;
  authorId: string;
  type: PostKind;
  title?: string;
  content: string;
  tags?: string[];
  commentsCount: number;
  reactions: Record<string, number>;
  myReaction?: string | null;
  createdAt: string;
  updatedAt: string;
}

const authHeaders = (authorization?: string) =>
  authorization ? { Authorization: authorization } : undefined;

interface PostPage {
  items: PostView[];
  total: number;
}

@Injectable()
export class PostsClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  // `authorization` es el header del usuario que pide el feed: se reenvía para
  // que el Post Service incluya su reacción (myReaction) en cada publicación.
  async list(
    params: {
      authorId?: string;
      excludeAuthorId?: string;
      type?: PostKind;
      limit?: number;
    },
    authorization?: string,
  ): Promise<PostView[]> {
    const { data } = await firstValueFrom(
      this.http.get<PostPage>(`${this.baseUrl()}/posts`, {
        params,
        headers: authHeaders(authorization),
        timeout: 5000,
      }),
    );
    return data.items;
  }

  async batch(ids: string[], authorization?: string): Promise<PostView[]> {
    if (ids.length === 0) return [];
    const { data } = await firstValueFrom(
      this.http.get<PostView[]>(`${this.baseUrl()}/posts/batch`, {
        params: { ids: ids.join(',') },
        headers: authHeaders(authorization),
        timeout: 5000,
      }),
    );
    return data;
  }

  private baseUrl(): string {
    return this.config.get<string>('POST_SERVICE_URL') ?? 'http://localhost:3002';
  }
}
