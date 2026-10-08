'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Comment, Post, REACTIONS, ReactionType } from '@/lib/types';
import { Button, Card, ErrorText, Input, timeAgo } from './ui';

export function PostCard({
  post: initial,
  authorLabel,
  currentUserId,
  onDeleted,
}: {
  post: Post;
  authorLabel?: string;
  currentUserId: string;
  onDeleted?: (id: string) => void;
}) {
  const [post, setPost] = useState(initial);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const isAuthor = post.authorId === currentUserId;

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const react = (type: ReactionType) =>
    run(async () => setPost(await api.posts.react(post.id, type)));

  const clearReaction = () =>
    run(async () => {
      await api.posts.removeReaction(post.id);
      setPost(await api.posts.byId(post.id));
    });

  const toggleComments = () =>
    run(async () => {
      if (comments) return setComments(null);
      setComments(await api.posts.comments(post.id));
    });

  const addComment = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async () => {
      const created = await api.posts.addComment(post.id, draft);
      setComments((prev) => [...(prev ?? []), created]);
      setPost((prev) => ({ ...prev, commentsCount: prev.commentsCount + 1 }));
      setDraft('');
    });
  };

  const deleteComment = (commentId: string) =>
    run(async () => {
      await api.posts.removeComment(post.id, commentId);
      setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId));
      setPost((prev) => ({ ...prev, commentsCount: prev.commentsCount - 1 }));
    });

  const deletePost = () =>
    run(async () => {
      await api.posts.remove(post.id);
      onDeleted?.(post.id);
    });

  return (
    <Card>
      <div className="flex items-baseline gap-2 text-xs text-gray-500">
        <span className="rounded bg-gray-100 px-1.5 py-0.5">{post.type}</span>
        <Link href={`/u/${authorLabel ?? post.authorId}`} className="underline">
          {authorLabel ? `@${authorLabel}` : post.authorId.slice(0, 8)}
        </Link>
        <span>{timeAgo(post.createdAt)}</span>
        {isAuthor && (
          <button onClick={deletePost} disabled={busy} className="ml-auto text-red-600 underline">
            eliminar
          </button>
        )}
      </div>

      {post.title && <h3 className="mt-2 font-semibold">{post.title}</h3>}
      <p className="mt-1 whitespace-pre-wrap text-sm">{post.content}</p>

      <div className="mt-3 flex flex-wrap gap-1">
        {REACTIONS.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => react(type)}
            disabled={busy}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100"
          >
            {label} {post.reactions[type] ? post.reactions[type] : ''}
          </button>
        ))}
        <button
          onClick={clearReaction}
          disabled={busy}
          className="rounded px-2 py-0.5 text-xs text-gray-500 underline"
        >
          quitar mi reacción
        </button>
      </div>

      <button
        onClick={toggleComments}
        disabled={busy}
        className="mt-3 text-xs text-gray-600 underline"
      >
        {comments ? 'ocultar' : 'ver'} comentarios ({post.commentsCount})
      </button>

      <ErrorText error={error} />

      {comments && (
        <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
          {comments.length === 0 && (
            <p className="text-xs text-gray-500">Sin comentarios aún.</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="text-sm">
              <span className="text-xs text-gray-500">
                {comment.authorId === currentUserId ? 'tú' : comment.authorId.slice(0, 8)} ·{' '}
                {timeAgo(comment.createdAt)}
              </span>
              <p>
                {comment.content}
                {comment.authorId === currentUserId && (
                  <button
                    onClick={() => deleteComment(comment.id)}
                    className="ml-2 text-xs text-red-600 underline"
                  >
                    borrar
                  </button>
                )}
              </p>
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe un comentario"
              required
            />
            <Button type="submit" disabled={busy}>
              Enviar
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
