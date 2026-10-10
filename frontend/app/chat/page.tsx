'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Conversation, Profile } from '@/lib/types';
import { Session } from '@/lib/session';
import { useChatSocket } from '@/lib/use-chat-socket';
import { qk, useAcceptConversation, useInbox, useProfiles } from '@/lib/queries';
import { Protected } from '@/components/protected';
import { ConnectionDot } from '@/components/connection-dot';
import { FollowButton } from '@/components/follow-button';
import { Tabs } from '@/components/tabs';
import { Avatar, Button, ButtonLink, EmptyState, ErrorText, PageHeader, Spinner, cx, timeAgo } from '@/components/ui';

type Box = 'contacts' | 'requests';

export default function ChatListPage() {
  return <Protected>{(session) => <ChatList session={session} />}</Protected>;
}

function ChatList({ session }: { session: Session }) {
  const qc = useQueryClient();
  const [box, setBox] = useState<Box>('contacts');
  const { contacts, requests, error } = useInbox();
  const items = box === 'contacts' ? contacts : requests;
  const profiles = useProfiles([...(contacts ?? []), ...(requests ?? [])].map((c) => c.otherUserId));

  // Al llegar un mensaje nuevo por socket, se invalida la lista de conversaciones.
  const refresh = useCallback(() => void qc.invalidateQueries({ queryKey: qk.conversations() }), [qc]);
  const { connected } = useChatSocket(refresh);

  return (
    <>
      <PageHeader title="Mensajes" subtitle={<ConnectionDot connected={connected} />} />
      <Tabs<Box>
        id="inbox"
        value={box}
        onChange={setBox}
        className="border-b border-border"
        tabs={[
          { value: 'contacts', label: 'Contactos' },
          { value: 'requests', label: 'Solicitudes', count: requests?.length || undefined },
        ]}
      />
      <ErrorText error={error} />
      {!items && !error && <Spinner />}

      {items?.length === 0 &&
        (box === 'contacts' ? (
          <EmptyState
            title="Tu bandeja está vacía"
            body="Entra al perfil de un compañero y toca «Mensaje» para empezar una conversación."
            action={
              <ButtonLink href="/explorar" variant="primary">
                Buscar personas
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No tienes solicitudes"
            body="Aquí aparecen los mensajes de personas que no sigues. Puedes aceptarlos y seguirlas si quieres."
          />
        ))}

      {box === 'requests' && !!items?.length && (
        <p className="px-4 pt-3 text-sm text-fg-muted sm:px-5">
          No sabrán que viste su mensaje hasta que aceptes.
        </p>
      )}

      {/* key: cada pestaña es una lista nueva, sin animar la salida de la anterior. */}
      <ul key={box} className="py-1">
        <AnimatePresence initial={false}>
          {items?.map((c) => (
            <motion.li
              key={c.otherUserId}
              layout
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <ConversationRow
                conversation={c}
                profile={profiles[c.otherUserId]}
                myId={session.userId}
                request={box === 'requests'}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}

function ConversationRow({
  conversation: c,
  profile: p,
  myId,
  request,
}: {
  conversation: Conversation;
  profile: Profile | null | undefined;
  myId: string;
  request: boolean;
}) {
  const accept = useAcceptConversation();
  const unread = c.unreadCount > 0;
  const fromMe = c.lastMessage.senderId === myId;

  return (
    <div
      className={cx(
        'mx-2 my-1 rounded-2xl transition-colors hover:bg-surface sm:mx-3',
        unread && !request && 'bg-accent-soft hover:bg-accent-soft',
      )}
    >
      <Link href={`/chat/${c.otherUserId}`} className="flex items-center gap-3 px-3 py-3">
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
      {request && (
        <div className="flex gap-2 px-3 pb-3 pl-[4.25rem]">
          <Button
            variant="accent"
            size="sm"
            disabled={accept.isPending}
            onClick={() => accept.mutate(c.otherUserId)}
          >
            Aceptar
          </Button>
          <FollowButton userId={c.otherUserId} />
        </div>
      )}
    </div>
  );
}
