'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { ImageKind } from '@/lib/api';
import { useProfileImage } from '@/lib/queries';
import { Modal } from './modal';
import { Button, ErrorText, cx } from './ui';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
// El original puede pesar más: lo que se sube es el recorte re-codificado,
// que siempre queda por debajo del límite de 5 MB del servidor.
const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;

const SPEC: Record<ImageKind, { aspect: number; width: number; height: number; title: string }> = {
  avatar: { aspect: 1, width: 800, height: 800, title: 'Foto de perfil' },
  cover: { aspect: 3, width: 1500, height: 500, title: 'Foto de portada' },
};

// Selector + recorte + subida de la foto de perfil o la portada.
// `children` recibe la función que abre el selector de archivos.
export function ImagePicker({
  kind,
  children,
}: {
  kind: ImageKind;
  children: (open: () => void) => React.ReactNode;
}) {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const open = useCallback(() => {
    setPickError(null);
    input?.click();
  }, [input]);

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setPickError('Elige una imagen JPG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      setPickError('La imagen pesa más de 15 MB. Elige una más liviana.');
      return;
    }
    setSource(URL.createObjectURL(file));
  }

  function close() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
  }

  return (
    <>
      {children(open)}
      <input ref={setInput} type="file" accept={ACCEPT.join(',')} onChange={onFile} className="hidden" tabIndex={-1} />
      {pickError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {pickError}
        </p>
      )}
      <Modal open={!!source} onClose={close} title={`Ajustar ${SPEC[kind].title.toLowerCase()}`}>
        {source && <CropAndUpload kind={kind} source={source} onDone={close} onChangeFile={open} />}
      </Modal>
    </>
  );
}

function CropAndUpload({
  kind,
  source,
  onDone,
  onChangeFile,
}: {
  kind: ImageKind;
  source: string;
  onDone: () => void;
  onChangeFile: () => void;
}) {
  const spec = SPEC[kind];
  const { upload } = useProfileImage(kind);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Vista previa en vivo del recorte final (miniatura).
  useEffect(() => {
    if (!area) return;
    let alive = true;
    let url: string | null = null;
    const timer = window.setTimeout(async () => {
      const blob = await cropToBlob(source, area, kind === 'avatar' ? 160 : 450, kind === 'avatar' ? 160 : 150);
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      setPreview(url);
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [area, source, kind]);

  async function save() {
    if (!area) return;
    const blob = await cropToBlob(source, area, spec.width, spec.height);
    if (!blob) return;
    setProgress(0);
    upload.mutate(
      { file: blob, onProgress: setProgress },
      {
        onSuccess: onDone,
        onSettled: () => setProgress(null),
      },
    );
  }

  const busy = upload.isPending;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className={cx('relative w-full overflow-hidden rounded-2xl bg-fg', kind === 'avatar' ? 'h-80' : 'h-60')}>
        <Cropper
          image={source}
          crop={crop}
          zoom={zoom}
          aspect={spec.aspect}
          maxZoom={4}
          showGrid={kind === 'cover'}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, pixels) => setArea(pixels)}
          style={{ cropAreaStyle: { borderRadius: kind === 'avatar' ? 28 : 12, border: '2px solid var(--accent)' } }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          aria-label="Alejar"
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface"
        >
          <Minus size={18} aria-hidden />
        </button>
        <label htmlFor={`zoom-${kind}`} className="sr-only">
          Zoom
        </label>
        <input
          id={`zoom-${kind}`}
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-11 flex-1 accent-[var(--fg)]"
        />
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
          aria-label="Acercar"
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface"
        >
          <Plus size={18} aria-hidden />
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob local de vista previa
          <img
            src={preview}
            alt="Vista previa del recorte"
            className={cx('shrink-0 object-cover ring-1 ring-border', kind === 'avatar' ? 'h-14 w-14 rounded-[14px]' : 'h-12 w-36 rounded-lg')}
          />
        ) : (
          <span className={cx('shrink-0 bg-surface-hover', kind === 'avatar' ? 'h-14 w-14 rounded-[14px]' : 'h-12 w-36 rounded-lg')} />
        )}
        <p className="text-sm text-fg-muted">
          Arrastra para encuadrar y usa el zoom. Se guardará en {spec.width}×{spec.height}.
        </p>
      </div>

      {progress !== null && (
        <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>
          <span className="text-xs text-fg-muted">
            {progress < 1 ? `Subiendo… ${Math.round(progress * 100)}%` : 'Procesando imagen…'}
          </span>
        </div>
      )}
      <ErrorText error={upload.error} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onChangeFile} disabled={busy}>
          Elegir otra
        </Button>
        <Button type="button" variant="accent" onClick={save} disabled={busy || !area}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

// Recorta en un canvas y re-codifica a JPEG del tamaño final.
async function cropToBlob(src: string, area: Area, width: number, height: number): Promise<Blob | null> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}
