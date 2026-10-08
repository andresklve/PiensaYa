'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Conversation } from '@/lib/types';
import { Protected } from '@/components/protected';
import { Card, ErrorText, Spinner, timeAgo } from '@/components/ui';
import { useChatSocket } from '@/lib/use-chat-socket';

export default function ChatListPage() {
  return <Protected>{() => <ChatList />}</Protected>;
}

function ChatList() {
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.chat.conversations());
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Al llegar un mensaje nuevo por socket, refrescamos la lista de conversaciones.
  const { connected } = useChatSocket(load);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold">Conversaciones</h1>
        <span className="text-xs text-gray-500">
          {connected ? 'conectado en tiempo real' : 'desconectado'}
        </span>
      </div>

      <ErrorText error={error} />
      {!items && <Spinner />}

      {items?.length === 0 && (
        <Card>
          <p className="text-sm text-gray-600">
            No tienes conversaciones. Entra al perfil de alguien y usa &quot;Enviar
            mensaje&quot;.
          </p>
        </Card>
      )}

      {items?.map((conversation) => (
        <Link key={conversation.otherUserId} href={`/chat/${conversation.otherUserId}`}>
          <Card className="hover:bg-gray-50">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">
                {conversation.otherUserId.slice(0, 8)}
              </span>
              {conversation.unreadCount > 0 && (
                <span className="rounded bg-black px-1.5 text-xs text-white">
                  {conversation.unreadCount}
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500">
                {timeAgo(conversation.lastMessage.createdAt)}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-gray-600">
              {conversation.lastMessage.content}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
