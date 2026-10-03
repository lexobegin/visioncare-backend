import { registerAs } from '@nestjs/config';

/**
 * ══════════════════════════════════════════════════════
 * Configuración de Cloudflare R2 (almacenamiento S3-compatible)
 * R2 usa el SDK de AWS S3 apuntando al endpoint de Cloudflare.
 *
 * Endpoint resultante:
 *   https://<account_id>.r2.cloudflarestorage.com
 *
 * Nota: en Sprint 1 las credenciales pueden quedar "pendiente"
 * (no se usan hasta el módulo de capturas).
 * ══════════════════════════════════════════════════════
 */
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl: string;
  signedUrlTtl: number;
}

export const isR2Configured = (r2: R2Config): boolean =>
  r2.accessKeyId !== 'pendiente' &&
  r2.secretAccessKey !== 'pendiente' &&
  r2.accountId !== 'pendiente';

export default registerAs('r2', (): R2Config => {
  const accountId = process.env.R2_ACCOUNT_ID || 'pendiente';

  return {
    accountId,

    accessKeyId: process.env.R2_ACCESS_KEY_ID || 'pendiente',

    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'pendiente',

    bucket: process.env.R2_BUCKET || 'visioncare-archivos',

    // Endpoint S3-compatible que construye el cliente @aws-sdk/client-s3
    endpoint: accountId.includes('pendiente')
      ? ''
      : `https://${accountId}.r2.cloudflarestorage.com`,

    // Base pública para construir URLs de imágenes ya subidas
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || '',

    // Tiempo de validez de URLs firmadas (subidas/descargas temporales)
    signedUrlTtl: parseInt(process.env.R2_SIGNED_URL_TTL ?? '', 10) || 900,
  };
});