'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Message, Profile } from '@/lib/types';
import { Protected } from '@/components/protected';
import { Button, Card, ErrorText, Input, Spinner, timeAgo } from '@/components/ui';
import { useChatSocket } from '@/lib/use-chat-socket';
import { Session } from '@/lib/session';

export default function ConversationView() {
  return <Protected>{(session) => <Conversation session={session} />}</Protected>;
}

function Conversation({ session }: { session: Session }) {
  const params = useParams<{ userId: string }>();
  const otherUserId = params.userId;

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const onIncoming = useCallback(
    (message: Message) => {
      const mine = [session.userId, otherUserId];
      if (!mine.includes(message.senderId) || !mine.includes(message.recipientId)) {
        return;
      }
      setMessages((prev) =>
        (prev ?? []).some((m) => m.id === message.id) ? prev : [...(prev ?? []), message],
      );
    },
    [session.userId, otherUserId],
  );

  const { connected, sendMessage } = useChatSocket(onIncoming);

  useEffect(() => {
    (async () => {
      try {
        const [history, profile] = await Promise.all([
          api.chat.history(otherUserId),
          api.users.byId(otherUserId).catch(() => null),
        ]);
        setMessages(history);
        setOther(profile);
        await api.chat.markRead(otherUserId);
      } catch (e) {
        setError(e);
      }
    })();
  }, [otherUserId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Por socket si está conectado; si no, por REST (el backend acepta ambos).
      if (connected) {
        await sendMessage(otherUserId, draft);
      } else {
        onIncoming(await api.chat.send(otherUserId, draft));
      }
      setDraft('');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <Link href="/chat" className="text-sm underline">
          ← Conversaciones
        </Link>
        <span className="font-bold">
          {other ? `${other.firstName} ${other.lastName} · @${other.username}` : otherUserId.slice(0, 8)}
        </span>
        <span className="ml-auto text-xs text-gray-500">
          {connected ? 'en tiempo real' : 'enviando por REST'}
        </span>
      </div>

      <Card className="max-h-[60vh] space-y-2 overflow-y-auto">
        {!messages && <Spinner />}
        {messages?.length === 0 && (
          <p className="text-sm text-gray-500">No hay mensajes. Escribe el primero.</p>
        )}
        {messages?.map((message) => {
          const mine = message.senderId === session.userId;
          return (
            <div key={message.id} className={mine ? 'text-right' : 'text-left'}>
              <span
                className={`inline-block rounded px-3 py-1.5 text-sm ${
                  mine ? 'bg-black text-white' : 'bg-gray-100'
                }`}
              >
                {message.content}
              </span>
              <p className="text-[10px] text-gray-400">{timeAgo(message.createdAt)}</p>
            </div>
          );
        })}
        <div ref={bottom} />
      </Card>

      <ErrorText error={error} />

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe un mensaje"
          required
        />
        <Button type="submit" disabled={busy}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
