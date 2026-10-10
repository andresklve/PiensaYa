import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { FEED_CLIENT, FollowEvent, USER_FOLLOWED, USER_UNFOLLOWED } from './follow-events';

// Avisa al Feed Service para que agregue (o quite) las publicaciones de esa
// persona en el feed "Siguiendo". Si RabbitMQ no está disponible, el follow
// igual se guarda: el feed queda desactualizado pero nada se rompe.
@Injectable()
export class FollowEventsPublisher {
  private readonly logger = new Logger(FollowEventsPublisher.name);

  constructor(@Inject(FEED_CLIENT) private readonly client: ClientProxy) {}

  followed(followerId: string, followingId: string): void {
    this.publish(USER_FOLLOWED, { followerId, followingId, occurredAt: new Date().toISOString() });
  }

  unfollowed(followerId: string, followingId: string): void {
    this.publish(USER_UNFOLLOWED, { followerId, followingId, occurredAt: new Date().toISOString() });
  }

  private publish(pattern: string, payload: FollowEvent): void {
    firstValueFrom(this.client.emit(pattern, payload)).catch((error) => {
      this.logger.warn(`No se pudo publicar el evento ${pattern}: ${error?.message ?? error}`);
    });
  }
}
