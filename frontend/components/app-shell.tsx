'use client';

import { usePathname } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { BottomNav, InboxListener, IndexNav, TopBar } from './nav';
import { RightPanel } from './right-panel';
import { cx } from './ui';

const BARE_ROUTES = ['/', '/login', '/registro'];

// Barra superior + índice (izquierda) + columna de contenido + panel (derecha).
// Bajo lg el índice pasa a la barra inferior; bajo xl desaparece el panel.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_ROUTES.includes(pathname);
  const inConversation = pathname.startsWith('/chat/');
  const { session } = useAuth();

  return (
    <MotionConfig reducedMotion="user">
      {bare ? (
        <main id="contenido" tabIndex={-1} className="outline-none">
          {children}
        </main>
      ) : (
        <>
          {/* key: un socket por sesión; al cambiar de cuenta se reconecta con el token nuevo. */}
          {session && !pathname.startsWith('/chat') && <InboxListener key={session.userId} />}
          <TopBar />
          <div className="mx-auto flex max-w-[1280px] justify-center gap-8 lg:px-5">
            <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[220px] shrink-0 lg:block">
              <IndexNav />
            </aside>
            <main
              id="contenido"
              tabIndex={-1}
              className={cx(
                'min-h-[calc(100dvh-4rem)] w-full min-w-0 max-w-[660px] border-border outline-none sm:border-x lg:pb-0',
                inConversation ? 'pb-14' : 'pb-20',
              )}
            >
              {children}
            </main>
            <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[300px] shrink-0 overflow-y-auto xl:block">
              <RightPanel />
            </aside>
          </div>
          <BottomNav />
        </>
      )}
    </MotionConfig>
  );
}
