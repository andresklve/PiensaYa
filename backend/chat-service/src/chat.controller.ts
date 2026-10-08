import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import {
  ConversationSummaryDto,
  MessageResponseDto,
} from './dto/message-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './strategies/jwt.strategy';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat/conversations')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar mis conversaciones con su último mensaje' })
  @ApiResponse({ status: 200, type: [ConversationSummaryDto] })
  listConversations(
    @CurrentUser() user: AuthUser,
  ): Promise<ConversationSummaryDto[]> {
    return this.chatService.listConversations(user.userId);
  }

  @Get(':otherUserId/messages')
  @ApiOperation({ summary: 'Historial de mensajes con otro usuario (paginado)' })
  @ApiResponse({ status: 200, type: [MessageResponseDto] })
  getHistory(
    @CurrentUser() user: AuthUser,
    @Param('otherUserId') otherUserId: string,
    @Query() query: HistoryQueryDto,
  ): Promise<MessageResponseDto[]> {
    return this.chatService.getHistory(
      user.userId,
      otherUserId,
      query.limit,
      query.before,
    );
  }

  @Post(':otherUserId/messages')
  @ApiOperation({
    summary:
      'Enviar un mensaje por REST (también se entrega en tiempo real por WebSocket)',
  })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  @ApiResponse({ status: 404, description: 'El destinatario no existe' })
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('otherUserId') otherUserId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    const message = await this.chatService.sendMessage(
      user.userId,
      otherUserId,
      dto.content,
    );
    this.chatGateway.notifyNewMessage(message);
    return message;
  }

  @Patch(':otherUserId/read')
  @ApiOperation({ summary: 'Marcar como leídos los mensajes recibidos de ese usuario' })
  @ApiResponse({ status: 200 })
  async markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('otherUserId') otherUserId: string,
  ): Promise<{ updated: number }> {
    const updated = await this.chatService.markAsRead(user.userId, otherUserId);
    return { updated };
  }
}
