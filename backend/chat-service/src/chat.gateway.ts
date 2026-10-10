import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { MessageResponseDto } from './dto/message-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

interface SendMessagePayload {
  toUserId: string;
  content: string;
}

const userRoom = (userId: string) => `user:${userId}`;

// El ThrottlerGuard solo cubre HTTP: por socket se limita aquí, por usuario,
// con el mismo tope que POST /messages (ventana deslizante de 1 minuto).
const SOCKET_MESSAGES_PER_MINUTE = 30;

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly recentSends = new Map<string, number[]>();

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data.userId = payload.sub;
      await client.join(userRoom(payload.sub));
    } catch {
      client.emit('error', { message: 'Token inválido o ausente' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('send_message')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    if (this.isRateLimited(client.data.userId)) {
      return {
        status: 'error',
        message: 'Estás enviando mensajes muy rápido. Espera un momento.',
      };
    }
    try {
      const message = await this.chatService.sendMessage(
        client.data.userId,
        payload?.toUserId,
        payload?.content,
      );
      this.notifyNewMessage(message);
      return { status: 'ok', message };
    } catch (error) {
      const message =
        error instanceof HttpException
          ? error.message
          : 'Error al enviar el mensaje';
      if (!(error instanceof HttpException)) this.logger.error(error);
      return { status: 'error', message };
    }
  }

  notifyNewMessage(message: MessageResponseDto): void {
    this.server
      .to(userRoom(message.recipientId))
      .to(userRoom(message.senderId))
      .emit('new_message', message);
  }

  isRateLimited(userId: string, now = Date.now()): boolean {
    if (process.env.THROTTLE_DISABLED === 'true') return false;
    const recent = (this.recentSends.get(userId) ?? []).filter(
      (t) => now - t < 60_000,
    );
    const limited = recent.length >= SOCKET_MESSAGES_PER_MINUTE;
    if (!limited) recent.push(now);
    this.recentSends.set(userId, recent);
    return limited;
  }

  private extractToken(client: Socket): string {
    const fromAuth = client.handshake.auth?.token as string | undefined;
    if (fromAuth) return fromAuth.replace(/^Bearer\s+/i, '');

    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);

    throw new Error('missing token');
  }
}
