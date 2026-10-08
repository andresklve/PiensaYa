import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  FEED_CLIENT,
  POST_CREATED,
  POST_DELETED,
  PostCreatedEvent,
  PostDeletedEvent,
} from './post-events';

@Injectable()
export class PostEventsPublisher {
  private readonly logger = new Logger(PostEventsPublisher.name);

  constructor(@Inject(FEED_CLIENT) private readonly client: ClientProxy) {}

  postCreated(event: PostCreatedEvent): void {
    this.publish(POST_CREATED, event);
  }

  postDeleted(event: PostDeletedEvent): void {
    this.publish(POST_DELETED, event);
  }

  private publish(pattern: string, payload: object): void {
    firstValueFrom(this.client.emit(pattern, payload)).catch((error) => {
      this.logger.warn(
        `No se pudo publicar el evento ${pattern}: ${error?.message ?? error}`,
      );
    });
  }
}
