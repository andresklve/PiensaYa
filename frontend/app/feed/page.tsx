'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { FeedItem } from '@/lib/types';
import { Protected } from '@/components/protected';
import { Composer } from '@/components/composer';
import { Button, Card, ErrorText, Spinner, timeAgo } from '@/components/ui';

export default function FeedPage() {
  return <Protected>{() => <Feed />}</Protected>;
}

function Feed() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      const page = await api.feed.mine({ limit: 30 });
      setItems(page.items);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // El feed lo arma el Feed Service al consumir el evento de RabbitMQ,
  // así que tras publicar hay que esperar un instante antes de recargar.
  const afterPublish = () => setTimeout(load, 1200);

  return (
    <div className="space-y-4">
      <Composer onCreated={afterPublish} />

      <div className="flex items-center justify-between">
        <h1 className="font-bold">Tu feed</h1>
        <Button variant="secondary" onClick={load}>
          Actualizar
        </Button>
      </div>

      <ErrorText error={error} />

      {!items && <Spinner />}

      {items?.length === 0 && (
        <Card>
          <p className="text-sm text-gray-600">
            Tu feed está vacío. Publica algo o sigue a alguien en{' '}
            <Link href="/explorar" className="underline">
              Explorar
            </Link>
            .
          </p>
        </Card>
      )}

      {items?.map((item) => (
        <Card key={item.postId}>
          <div className="flex items-baseline gap-2 text-xs text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{item.type}</span>
            {item.authorUsername ? (
              <Link href={`/u/${item.authorUsername}`} className="underline">
                {item.authorName} · @{item.authorUsername}
              </Link>
            ) : (
              <span>{item.authorId.slice(0, 8)}</span>
            )}
            <span>{timeAgo(item.createdAt)}</span>
          </div>
          {item.title && <h3 className="mt-2 font-semibold">{item.title}</h3>}
          <p className="mt-1 whitespace-pre-wrap text-sm">{item.excerpt}</p>
          <Link
            href={`/post/${item.postId}`}
            className="mt-2 inline-block text-xs text-gray-600 underline"
          >
            abrir publicación
          </Link>
        </Card>
      ))}
    </div>
  );
}
