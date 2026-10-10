'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Conversation } from '@/lib/types';
import { Session } from '@/lib/session';
import { useChatSocket } from '@/lib/use-chat-socket';
import { qk, useProfiles } from '@/lib/queries';
import { Protected } from '@/components/protected';
import { ConnectionDot } from '@/components/connection-dot';
import { Avatar, ButtonLink, EmptyState, ErrorText, PageHeader, Spinner, cx, timeAgo } from '@/components/ui';

export default function ChatListPage() {
  return <Protected>{(session) => <ChatList session={session} />}</Protected>;
}

function ChatList({ session }: { session: Session }) {
  const qc = useQueryClient();
  const { data: items, error } = useQuery<Conversation[]>({
    queryKey: qk.conversations(),
    queryFn: api.chat.conversations,
  });
  const profiles = useProfiles(items?.map((c) => c.otherUserId) ?? []);

  // Al llegar un mensaje nuevo por socket, se invalida la lista de conversaciones.
  const refresh = useCallback(() => void qc.invalidateQueries({ queryKey: qk.conversations() }), [qc]);
  const { connected } = useChatSocket(refresh);

  return (
    <>
      <PageHeader title="Mensajes" subtitle={<ConnectionDot connected={connected} />} />
      <ErrorText error={error} />
      {!items && !error && <Spinner />}

      {items?.length === 0 && (
        <EmptyState
          title="Tu bandeja está vacía"
          body="Entra al perfil de un compañero y toca «Mensaje» para empezar una conversación."
          action={
            <ButtonLink href="/explorar" variant="primary">
              Buscar personas
            </ButtonLink>
          }
        />
      )}

      <ul className="py-1">
        <AnimatePresence initial={false}>
          {items?.map((c) => {
            const p = profiles[c.otherUserId];
            const unread = c.unreadCount > 0;
            const fromMe = c.lastMessage.senderId === session.userId;
            return (
              <motion.li key={c.otherUserId} layout transition={{ duration: 0.2, ease: 'easeOut' }}>
                <Link
                  href={`/chat/${c.otherUserId}`}
                  className={cx(
                    'mx-2 my-1 flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface sm:mx-3',
                    unread && 'bg-accent-soft hover:bg-accent-soft',
                  )}
                >
                  <Avatar firstName={p?.firstName} lastName={p?.lastName} avatarUrl={p?.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[15px]">
                      <span className="truncate font-display font-extrabold tracking-tight">
                        {p ? `${p.firstName} ${p.lastName}` : c.otherUserId.slice(0, 8)}
                      </span>
                      {p && <span className="truncate text-fg-muted">@{p.username}</span>}
                      <span className="text-fg-muted">·</span>
                      <span className="shrink-0 text-fg-muted">{timeAgo(c.lastMessage.createdAt)}</span>
                    </div>
                    <p className={cx('truncate text-[15px]', unread ? 'font-semibold text-fg' : 'text-fg-muted')}>
                      {fromMe && 'Tú: '}
                      {c.lastMessage.content}
                    </p>
                  </div>
                  {unread && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-accent px-1.5 text-xs font-bold text-accent-ink ring-1 ring-fg/15"
                      aria-label={`${c.unreadCount} sin leer`}
                    >
                      {c.unreadCount}
                    </motion.span>
                  )}
                </Link>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </>
  );
}
