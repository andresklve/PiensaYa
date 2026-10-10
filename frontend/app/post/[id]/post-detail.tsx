'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Quote, Trash2 } from 'lucide-react';
import { REACTIONS } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useDeletePost, useMarkSeen, usePost, useProfile } from '@/lib/queries';
import { CommentThread, ReactionBar } from '@/components/post-interactions';
import { FollowButton } from '@/components/follow-button';
import { readingTime } from '@/components/post-card';
import { RichText, TagChips } from '@/components/rich-text';
import { Avatar, EmptyState, ErrorText, PageHeader, Spinner, compactNumber, fullDate } from '@/components/ui';

const TYPE_LABEL = { POST: 'Artículo', TWEET: 'Apunte', OPINION: 'Opinión' } as const;

export default function PostDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { data: post, error: loadError } = usePost(params.id);
  const { data: author } = useProfile(post?.authorId);
  const deletePost = useDeletePost();
  const error = deletePost.error;
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const { mutate: markSeen } = useMarkSeen();
  const ownPostId = post && session && post.authorId === session.userId ? post.id : null;

  // Abrir tu propia publicación cuenta como haber visto su actividad.
  useEffect(() => {
    if (ownPostId) markSeen(ownPostId);
  }, [ownPostId, markSeen]);

  function remove() {
    if (!post) return;
    deletePost.mutate(post.id, { onSuccess: () => router.push('/feed') });
  }

  if (loadError && !post) {
    return (
      <>
        <PageHeader title="Publicación" back />
        <EmptyState title="Esta publicación no existe" body="Puede que haya sido eliminada." />
      </>
    );
  }
  if (!post) {
    return (
      <>
        <PageHeader title="Publicación" back />
        <Spinner />
      </>
    );
  }

  const isArticle = post.type === 'POST';
  const currentUserId = session?.userId ?? '';
  const isAuthor = post.authorId === currentUserId;
  const totalReactions = REACTIONS.reduce((s, r) => s + (post.reactions[r.type] ?? 0), 0);

  const authorRow = (
    <div className="flex items-center gap-3">
      <Link href={author ? `/u/${author.username}` : '#'} className="rounded-[14px]">
        <Avatar firstName={author?.firstName} lastName={author?.lastName} avatarUrl={author?.avatarUrl} size="md" />
      </Link>
      <div className="min-w-0 flex-1 leading-tight">
        <Link href={author ? `/u/${author.username}` : '#'} className="block truncate font-display font-extrabold tracking-tight hover:underline">
          {author ? `${author.firstName} ${author.lastName}` : post.authorId.slice(0, 8)}
        </Link>
        {author && <span className="block truncate text-[15px] text-fg-muted">@{author.username}</span>}
      </div>
      {session && !isAuthor && <FollowButton userId={post.authorId} />}
      {isAuthor && (
        <button
          onClick={remove}
          aria-label="Eliminar publicación"
          title="Eliminar"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 size={18} aria-hidden />
        </button>
      )}
    </div>
  );

  return (
    <>
      {isArticle && <ReadingProgress />}
      <PageHeader title={TYPE_LABEL[post.type]} back />

      <article className="px-4 pt-6 sm:px-8">
        {isArticle ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              <span className="rounded-lg bg-surface px-2 py-0.5 text-xs font-bold tracking-wide text-fg">Artículo</span>
              {readingTime(post.content)} min de lectura · {fullDate(post.createdAt)}
            </div>
            <h1 className="mt-4 font-display text-[32px] font-extrabold leading-[1.08] tracking-[-0.025em] sm:text-[42px]">
              {post.title}
            </h1>
            <div className="mt-6 border-y border-dashed border-border py-4">{authorRow}</div>
            <div className="mx-auto mt-8 max-w-[65ch] text-[18px] leading-[1.8] text-fg">
              {post.content.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="mb-6 whitespace-pre-wrap break-words">
                  <RichText text={p} />
                </p>
              ))}
              <TagChips tags={post.tags} className="mb-2" />
            </div>
          </>
        ) : (
          <>
            {authorRow}
            {post.type === 'OPINION' ? (
              <blockquote className="relative mt-6 pl-10">
                <Quote size={30} className="absolute left-0 top-1 -scale-x-100 fill-fg text-fg" aria-hidden />
                <p className="whitespace-pre-wrap break-words font-display text-[22px] font-medium leading-snug tracking-[-0.015em] sm:text-[26px]">
                  <RichText text={post.content} />
                </p>
              </blockquote>
            ) : (
              <p className="mt-5 whitespace-pre-wrap break-words text-[19px] leading-relaxed sm:text-[21px]">
                <RichText text={post.content} />
              </p>
            )}
            <p className="mt-4 text-sm text-fg-muted">
              {TYPE_LABEL[post.type]} · {fullDate(post.createdAt)}
            </p>
          </>
        )}

        <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-dashed border-border pt-4">
          {[
            { label: 'Subrayados', value: post.reactions.LIKE ?? 0 },
            { label: 'Reacciones', value: totalReactions },
            { label: 'Comentarios', value: post.commentsCount },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-surface px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">{s.label}</dt>
              <dd className="font-display text-xl font-extrabold tabular-nums">{compactNumber(s.value)}</dd>
            </div>
          ))}
        </dl>
        <ReactionBar
          post={post}
          currentUserId={currentUserId}
          onComment={() => replyRef.current?.focus()}
          className="py-2"
        />
        <ErrorText error={error} />
      </article>

      <section id="comentarios" aria-labelledby="comentarios-titulo" className="scroll-mt-32 border-t border-border">
        <h2 id="comentarios-titulo" className="px-4 pt-5 font-display text-lg font-extrabold tracking-tight sm:px-5">
          Comentarios
        </h2>
        <CommentThread
          postId={post.id}
          currentUserId={currentUserId}
          inputRef={replyRef}
        />
      </section>
    </>
  );
}

function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX, originX: 0 }}
      className="fixed inset-x-0 top-0 z-40 h-1 bg-accent"
    />
  );
}
