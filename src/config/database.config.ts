import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { isProduction } from './app.config';

/**
 * ══════════════════════════════════════════════════════
 * Configuración de PostgreSQL (TypeORM)
 * - Desarrollo: synchronize=true (crea/actualiza tablas automáticamente)
 * - Producción: synchronize=false SIEMPRE (usar migraciones)
 * - entidades: se cargan solas con autoLoadEntities en app.module.ts
 * ══════════════════════════════════════════════════════
 */
export interface DatabaseEnv {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  synchronize: boolean;
  logging: boolean;
  maxPool: number;
}

export default registerAs('database', (): TypeOrmModuleOptions => {
  const prod = isProduction(process.env.NODE_ENV);

  // En producción, fallar temprano si falta configuración crítica
  if (prod && !process.env.DB_PASSWORD) {
    throw new Error(
      'DB_PASSWORD es obligatoria en producción. Revisa las variables de entorno.',
    );
  }

  return {
    type: 'postgres',

    host: process.env.DB_HOST || 'localhost',

    port: parseInt(process.env.DB_PORT ?? '', 10) || 5432,

    username: process.env.DB_USERNAME || 'postgres',

    password: process.env.DB_PASSWORD || '12345',

    database: process.env.DB_DATABASE || 'visioncare_db',

    ssl: process.env.DB_SSL === 'true',

    // NUNCA en producción (peligro: altera el esquema en cada arranque)
    synchronize: prod ? false : process.env.DB_SYNCHRONIZE !== 'false',

    logging: prod ? ['error', 'warn'] : process.env.DB_LOGGING !== 'false',

    maxQueryExecutionTime: 5000, // loguea queries lentas (>5s)

    poolSize: parseInt(process.env.DB_MAX_POOL ?? '', 10) || 10,

    autoLoadEntities: true, // las entidades registradas en módulos se cargan solas

    // Comportamiento estricto ante errores de conexión
    retryAttempts: prod ? 10 : 3,
    retryDelay: 3000,
  };
});