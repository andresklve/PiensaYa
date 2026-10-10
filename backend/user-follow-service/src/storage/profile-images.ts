import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export type ProfileImageKind = 'avatar' | 'cover';

// Lo único que usamos del archivo que entrega multer (memoryStorage).
export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

// Tamaño final de cada imagen: el avatar es cuadrado y la portada 3:1.
const SIZES: Record<ProfileImageKind, { width: number; height: number }> = {
  avatar: { width: 400, height: 400 },
  cover: { width: 1500, height: 500 },
};

// Valida la imagen por su contenido real (no por la extensión ni el
// Content-Type que manda el cliente), la recorta al tamaño de destino y la
// convierte a WebP. Quita metadatos EXIF (ubicación, cámara) de paso.
export async function processProfileImage(
  buffer: Buffer,
  kind: ProfileImageKind,
): Promise<Buffer> {
  if (buffer.length === 0) {
    throw new BadRequestException('El archivo está vacío');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new BadRequestException('La imagen no puede superar los 5 MB');
  }

  let format: string | undefined;
  try {
    format = (await sharp(buffer).metadata()).format;
  } catch {
    format = undefined;
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new BadRequestException('Formato no soportado: sube una imagen JPG, PNG o WebP');
  }

  const { width, height } = SIZES[kind];
  return sharp(buffer)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toBuffer();
}
