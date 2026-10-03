import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig, { AppConfig } from './config/app.config';
import databaseConfig from './config/database.config';
import r2Config from './config/r2.config';
import { HealthController } from '@/modules/health.controller';

import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import jwtConfig from './config/jwt.config';

import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';

import { UsuariosModule } from './modules/usuarios/usuarios.module';

import { InstitucionesModule } from './modules/instituciones/instituciones.module';

import { AccesibilidadModule } from './modules/accesibilidad/accesibilidad.module';

import { ContactosModule } from './modules/contactos/contactos.module';

import { VozModule } from './modules/voz/voz.module';

import { ArchivosModule } from './modules/archivos/archivos.module';
import { CapturasModule } from './modules/capturas/capturas.module';

import { HistorialModule } from './modules/historial/historial.module';

/**
 * ══════════════════════════════════════════════════════
 * Módulo raíz de VisionCare AI
 * - ConfigModule: carga configs tipadas (app, database, r2)
 * - TypeOrmModule: conexión a PostgreSQL (autoLoadEntities)
 * - ThrottlerModule: rate limiting global (protección)
 * - HealthController: verificación de estado de la API
 *
 * Los módulos de dominio (auth, usuarios, capturas...) se
 * irán importando aquí en las siguientes tandas.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    // ─── Configuración global (disponible en toda la app) ───
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, r2Config, jwtConfig],
    }),

    // ─── PostgreSQL ───
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<TypeOrmModuleOptions>('database')!,
    }),

    // ─── Rate limiting (valores desde .env) ───
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const appCfg = config.get<AppConfig>('app')!;
        return {
          throttlers: [
            { ttl: appCfg.throttle.ttlMs, limit: appCfg.throttle.limit },
          ],
        };
      },
    }),
    // ─── Módulos de dominio ───
    AuthModule,
    UsuariosModule,
    InstitucionesModule,
    AccesibilidadModule,
    ContactosModule,
    VozModule,
    ArchivosModule,   // global (R2)
    CapturasModule,
    HistorialModule, // 🆕
  ],

  controllers: [HealthController],

  providers: [
    // Orden de ejecución: Throttler → JWT → Roles
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // 1º rate limiting
    { provide: APP_GUARD, useClass: JwtAuthGuard },   // 2º autenticación
    { provide: APP_GUARD, useClass: RolesGuard },     // 3º autorización

    // Filtro global: formato único de errores en toda la API
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}