import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

// Adaptador de almacenamiento sobre la API de S3. En local apunta al
// contenedor S3Mock; en AWS basta con cambiar las variables STORAGE_* (y
// quitar STORAGE_ENDPOINT para usar el endpoint real de S3).
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('STORAGE_ENDPOINT');
    this.bucket = config.get<string>('STORAGE_BUCKET') ?? 'piensaya-media';
    this.publicBaseUrl = (
      config.get<string>('STORAGE_PUBLIC_URL') ??
      `${endpoint ?? ''}/${this.bucket}`
    ).replace(/\/$/, '');

    this.client = new S3Client({
      region: config.get<string>('STORAGE_REGION') ?? 'us-east-1',
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId: config.get<string>('STORAGE_ACCESS_KEY') ?? 'local',
        secretAccessKey: config.get<string>('STORAGE_SECRET_KEY') ?? 'local',
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket ${this.bucket} creado`);
      } catch (error) {
        // No impide arrancar: perfiles y follows funcionan sin almacenamiento,
        // solo fallará la subida de imágenes hasta que el bucket exista.
        this.logger.warn(
          `No se pudo preparar el bucket ${this.bucket}: ${(error as Error).message}`,
        );
      }
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicBaseUrl}/${key}`;
  }

  // Borra un objeto a partir de su URL pública; ignora URLs que no son nuestras.
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url?.startsWith(`${this.publicBaseUrl}/`)) return;
    const key = url.slice(this.publicBaseUrl.length + 1);
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.warn(`No se pudo borrar ${key}: ${(error as Error).message}`);
    }
  }
}
