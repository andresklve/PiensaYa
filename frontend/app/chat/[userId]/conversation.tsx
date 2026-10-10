'use client';

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { SendHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { Message, Profile } from '@/lib/types';
import { Session } from '@/lib/session';
import { useChatSocket } from '@/lib/use-chat-socket';
import { Protected } from '@/components/protected';
import { ConnectionDot } from '@/components/connection-dot';
import { Avatar, ErrorText, PageHeader, Spinner, cx } from '@/components/ui';

export default function ConversationView() {
  return <Protected>{(session) => <Conversation session={session} />}</Protected>;
}

const dayKey = (iso: string) => new Date(iso).toDateString();

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hoy';
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
}

const hour = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });

function Conversation({ session }: { session: Session }) {
  const params = useParams<{ userId: string }>();
  const otherUserId = params.userId;

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const onIncoming = useCallback(
    (message: Message) => {
      const pair = [session.userId, otherUserId];
      if (!pair.includes(message.senderId) || !pair.includes(message.recipientId)) return;
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

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setError(null);
    setBusy(true);
    try {
      // Por socket si está conectado; si no, por REST (el backend acepta ambos).
      if (connected) {
        onIncoming(await sendMessage(otherUserId, content));
      } else {
        onIncoming(await api.chat.send(otherUserId, content));
      }
      setDraft('');
      input.current?.focus();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const name = other ? `${other.firstName} ${other.lastName}` : otherUserId.slice(0, 8);

  return (
    <div className="flex h-[calc(100dvh-4rem-3.5rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      <PageHeader
        back
        title={
          <span className="flex items-center gap-2">
            <Avatar firstName={other?.firstName} lastName={other?.lastName} avatarUrl={other?.avatarUrl} size="xs" />
            <span className="truncate text-[17px]">{name}</span>
          </span>
        }
        subtitle={<ConnectionDot connected={connected} />}
      />

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 pb-4">
        {other && (
          <Link
            href={`/u/${other.username}`}
            className="paper-dots mt-4 flex flex-col items-center rounded-2xl px-4 py-8 text-center transition-opacity hover:opacity-90"
          >
            <Avatar firstName={other.firstName} lastName={other.lastName} avatarUrl={other.avatarUrl} size="md" className="!h-16 !w-16" />
            <span className="mt-3 font-display text-lg font-extrabold tracking-tight">{name}</span>
            <span className="text-[15px] text-fg-muted">@{other.username}</span>
            {other.bio && <span className="mt-2 max-w-sm text-[15px]">{other.bio}</span>}
            <span className="mt-2 text-sm text-fg-muted">
              {other.followersCount} seguidores
            </span>
          </Link>
        )}

        {!messages && !error && <Spinner />}
        {messages?.length === 0 && (
          <p className="py-10 text-center text-fg-muted">Envía el primer mensaje para empezar la conversación.</p>
        )}

        <ul className="flex flex-col gap-0.5 pt-4">
          <AnimatePresence initial={false}>
            {messages?.map((m, i) => {
              const mine = m.senderId === session.userId;
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
              const firstOfGroup = newDay || prev?.senderId !== m.senderId;
              const lastOfGroup =
                !next || next.senderId !== m.senderId || dayKey(next.createdAt) !== dayKey(m.createdAt);
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <li className="flex items-center gap-3 py-4 text-xs font-bold uppercase tracking-[0.08em] text-fg-muted">
                      <span className="h-px flex-1 border-t border-dashed border-border" />
                      {dayLabel(m.createdAt)}
                      <span className="h-px flex-1 border-t border-dashed border-border" />
                    </li>
                  )}
                  <motion.li
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                    style={{ originX: mine ? 1 : 0, originY: 1 }}
                    className={cx('flex flex-col', mine ? 'items-end' : 'items-start', firstOfGroup && 'mt-2')}
                  >
                    <p
                      className={cx(
                        'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
                        mine ? 'bg-fg text-bg' : 'border border-border bg-bg text-fg',
                        mine ? 'rounded-br-md' : 'rounded-bl-md',
                        !firstOfGroup && (mine ? 'rounded-tr-md' : 'rounded-tl-md'),
                      )}
                    >
                      {m.content}
                    </p>
                    {lastOfGroup && (
                      <span className="mt-1 px-1 text-xs text-fg-muted">
                        {hour(m.createdAt)}
                        {mine && m.readAt && ' · Visto'}
                      </span>
                    )}
                  </motion.li>
                </Fragment>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      <div className="border-t border-border bg-bg px-3 py-2">
        <ErrorText error={error} />
        <form onSubmit={send} className="flex items-end gap-2 rounded-2xl border border-transparent bg-surface p-1.5 pl-4 transition-[border-color,box-shadow] focus-within:border-fg focus-within:shadow-[0_0_0_4px_var(--accent-soft)]">
          <label htmlFor="message" className="sr-only">
            Escribe un mensaje
          </label>
          <textarea
            id="message"
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Escribe un mensaje"
            rows={1}
            className="field-sizing-content max-h-36 min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-fg-muted"
          />
          <motion.button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Enviar"
            whileTap={{ scale: 0.88 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink transition-opacity disabled:opacity-40"
          >
            <SendHorizontal size={18} aria-hidden />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
