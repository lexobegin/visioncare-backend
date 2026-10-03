import { registerAs } from '@nestjs/config';

/**
 * ══════════════════════════════════════════════════════
 * Configuración general de la aplicación
 * Lee variables de entorno y las expone tipadas.
 * Acceso en cualquier parte: configService.get('app.port')
 * ══════════════════════════════════════════════════════
 */
export interface AppConfig {
  appName: string;
  nodeEnv: 'development' | 'production';
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  throttle: {
    ttlMs: number;
    limit: number;
  };
}

export const isProduction = (env: string | undefined): boolean =>
  (env ?? '').trim().toLowerCase() === 'production';

export default registerAs('app', (): AppConfig => {
  const nodeEnv = isProduction(process.env.NODE_ENV) ? 'production' : 'development';

  return {
    appName: process.env.APP_NAME || 'VisionCare AI API',

    nodeEnv,

    port: parseInt(process.env.PORT ?? '', 10) || 3000,

    apiPrefix: process.env.API_PREFIX || 'api/v1',

    // Lista separada por comas: "http://localhost:5173,https://mi-dominio.vercel.app"
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),

    swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',

    throttle: {
      ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '', 10) || 60000,
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '', 10) || 100,
    },
  };
});