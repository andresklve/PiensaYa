'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useMarkSeen, useOwnActivity, useProfile } from '@/lib/queries';
import { OwnPostActivity, PostType } from '@/lib/types';
import { PostCard } from './post-card';

// Tiempo que una tarjeta debe estar a la vista para contar como "vista".
const SEEN_AFTER_MS = 1500;

// Tus publicaciones solo aparecen en "Para ti" y Explorar cuando OTRA persona
// comentó o reaccionó y aún no lo viste. Al verla se marca en el servidor
// (vale en cualquier dispositivo) y deja de aparecer; vuelve si llega algo nuevo.
export function OwnActivity({ userId, type }: { userId: string; type?: PostType }) {
  const { data } = useOwnActivity(true);
  const { data: me } = useProfile(userId);
  const items = data?.filter((a) => !type || a.post.type === type) ?? [];

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.section
          aria-labelledby="actividad-titulo"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden border-b border-border bg-accent-soft/40 pb-2"
        >
          <h2
            id="actividad-titulo"
            className="flex items-center gap-2 px-4 pt-4 font-display text-[15px] font-extrabold tracking-tight sm:px-5"
          >
            <Sparkles size={16} aria-hidden />
            Actividad en tus publicaciones
          </h2>
          {items.map((activity) => (
            <ActivityCard key={activity.post.id} activity={activity} author={me} userId={userId} />
          ))}
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function ActivityCard({
  activity,
  author,
  userId,
}: {
  activity: OwnPostActivity;
  author: Parameters<typeof PostCard>[0]['author'];
  userId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const markSeen = useMarkSeen();
  const [seen, setSeen] = useState(false);
  const { mutate } = markSeen;
  const postId = activity.post.id;

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && document.visibilityState === 'visible') {
          timer = window.setTimeout(() => {
            setSeen(true);
            mutate(postId);
          }, SEEN_AFTER_MS);
        } else {
          window.clearTimeout(timer);
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [seen, mutate, postId]);

  const parts = [
    activity.newComments > 0 && `${activity.newComments} ${activity.newComments === 1 ? 'comentario nuevo' : 'comentarios nuevos'}`,
    activity.newReactions > 0 && `${activity.newReactions} ${activity.newReactions === 1 ? 'reacción nueva' : 'reacciones nuevas'}`,
  ].filter(Boolean);

  return (
    <div ref={ref}>
      <PostCard
        post={activity.post}
        author={author}
        currentUserId={userId}
        label={
          seen ? (
            <span className="flex items-center gap-1.5">
              <Check size={14} aria-hidden /> Visto · no volverá a aparecer hasta que haya algo nuevo
            </span>
          ) : (
            <span className="mark">{parts.join(' · ')}</span>
          )
        }
      />
    </div>
  );
}
