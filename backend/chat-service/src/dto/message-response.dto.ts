import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  conversationId: string;

  @ApiProperty()
  senderId: string;

  @ApiProperty()
  recipientId: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional({ nullable: true })
  readAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class ConversationSummaryDto {
  @ApiProperty()
  otherUserId: string;

  @ApiProperty({ type: MessageResponseDto })
  lastMessage: MessageResponseDto;

  @ApiProperty()
  unreadCount: number;
}
