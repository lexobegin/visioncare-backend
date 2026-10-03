import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { R2Config, isR2Configured } from '../../config/r2.config';

/** Tipos de imagen aceptados → extensión del archivo en R2 */
const MIME_A_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface ArchivoSubido {
  r2_key: string;
  url_publica: string | null;
}

/**
 * ══════════════════════════════════════════════════════
 * Servicio de almacenamiento Cloudflare R2 (S3-compatible).
 *
 * - Sube imágenes a capturas/{id_usuario}/{año}/{uuid}.{ext}
 * - Devuelve la key relativa (nunca la URL absoluta) para que
 *   la BD sea portable entre dominios/buckets.
 * - Si R2 no está configurado (credenciales "pendiente"), lanza
 *   503 con mensaje claro — el flujo de capturas degrada.
 *
 * Se registra como módulo GLOBAL: evidencias de incidentes,
 * fotos de perfil e insignias lo reutilizarán (Sprints 2–3).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly cliente: S3Client | null = null;
  private readonly r2: R2Config;

  constructor(config: ConfigService) {
    this.r2 = config.get<R2Config>('r2')!;

    if (isR2Configured(this.r2)) {
      this.cliente = new S3Client({
        region: 'auto',
        endpoint: this.r2.endpoint,
        credentials: {
          accessKeyId: this.r2.accessKeyId,
          secretAccessKey: this.r2.secretAccessKey,
        },
      });
      this.logger.log('☁️  Cloudflare R2 configurado correctamente.');
    } else {
      this.logger.warn(
        '⚠️  R2 SIN configurar (credenciales "pendiente" en .env). ' +
          'Las capturas se registrarán sin archivo.',
      );
    }
  }

  get configurado(): boolean {
    return this.cliente !== null;
  }

  /**
   * Sube una imagen al bucket.
   * @param idUsuario para organizar la estructura de carpetas
   * @throws ServiceUnavailableException si R2 no está configurado
   */
  async subirImagen(
    idUsuario: number,
    buffer: Buffer,
    mimeType: string,
  ): Promise<ArchivoSubido> {
    if (!this.cliente) {
      throw new ServiceUnavailableException(
        'El almacenamiento de archivos (R2) no está configurado. ' +
          'Contacta al administrador.',
      );
    }

    const extension = MIME_A_EXTENSION[mimeType];
    if (!extension) {
      throw new ServiceUnavailableException(
        `Tipo de imagen no soportado: ${mimeType}. ` +
          'Aceptados: JPEG, PNG, WEBP.',
      );
    }

    const ahora = new Date();
    const r2_key =
      `capturas/${idUsuario}/${ahora.getFullYear()}` +
      `/${String(ahora.getMonth() + 1).padStart(2, '0')}` +
      `/${randomUUID()}.${extension}`;

    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.r2.bucket,
        Key: r2_key,
        Body: buffer,
        ContentType: mimeType,
        // Metadatos útiles para auditoría del bucket
        Metadata: { usuario: String(idUsuario) },
      }),
    );

    this.logger.debug(`Imagen subida a R2: ${r2_key}`);

    return {
      r2_key,
      url_publica: this.r2.publicBaseUrl
        ? `${this.r2.publicBaseUrl}/${r2_key}`
        : null,
    };
  }

  /** Elimina un archivo (rollback si el flujo falla después de subir) */
  async eliminar(r2_key: string): Promise<void> {
    if (!this.cliente) return;

    try {
      await this.cliente.send(
        new DeleteObjectCommand({ Bucket: this.r2.bucket, Key: r2_key }),
      );
      this.logger.debug(`Archivo eliminado de R2: ${r2_key}`);
    } catch (error) {
      // No propagar: la limpieza es best-effort
      this.logger.warn(`No se pudo eliminar ${r2_key} de R2: ${error}`);
    }
  }

  /** Construye la URL pública a partir de una key */
  construirUrl(r2_key: string | null): string | null {
    if (!r2_key || !this.r2.publicBaseUrl) return null;
    return `${this.r2.publicBaseUrl}/${r2_key}`;
  }
}