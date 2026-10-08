'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Post, PostType } from '@/lib/types';
import { Button, Card, ErrorText, Input, Textarea } from './ui';

const TWEET_MAX = 280;

export function Composer({ onCreated }: { onCreated: (post: Post) => void }) {
  const [type, setType] = useState<PostType>('TWEET');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const tooLong = type === 'TWEET' && content.length > TWEET_MAX;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const post = await api.posts.create({
        type,
        content,
        title: type === 'POST' ? title : undefined,
      });
      onCreated(post);
      setTitle('');
      setContent('');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex gap-2 text-sm">
          {(['TWEET', 'POST'] as PostType[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={`rounded px-2 py-1 ${
                type === option ? 'bg-black text-white' : 'border border-gray-300'
              }`}
            >
              {option === 'TWEET' ? 'Tweet' : 'Artículo'}
            </button>
          ))}
        </div>

        {type === 'POST' && (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del artículo"
            required
          />
        )}

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === 'TWEET' ? '¿Qué estás pensando?' : 'Contenido del artículo'}
          rows={type === 'TWEET' ? 2 : 6}
          required
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || tooLong}>
            {busy ? 'Publicando...' : 'Publicar'}
          </Button>
          {type === 'TWEET' && (
            <span className={`text-xs ${tooLong ? 'text-red-600' : 'text-gray-500'}`}>
              {content.length}/{TWEET_MAX}
            </span>
          )}
        </div>
        <ErrorText error={error} />
      </form>
    </Card>
  );
}
