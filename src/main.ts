import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { AppConfig } from './config/app.config';

/**
 * ══════════════════════════════════════════════════════
 * Punto de entrada de VisionCare AI API
 * Configura: Helmet, CORS, prefijo global, validación de
 * DTOs, Swagger y cierre ordenado de la aplicación.
 * ══════════════════════════════════════════════════════
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const appCfg = config.get<AppConfig>('app')!;

  // ─── Seguridad: cabeceras HTTP (XSS, sniffing, etc.) ───
  app.use(helmet());

  // ─── CORS: solo orígenes definidos en CORS_ORIGINS ───
  app.enableCors({
    origin: appCfg.corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ─── Prefijo global: /api/v1 ───
  app.setGlobalPrefix(appCfg.apiPrefix);

  // ─── Validación global de DTOs (class-validator) ───
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,               // elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true,    // rechaza la petición si envía propiedades extra
      transform: true,               // convierte payload a instancias del DTO
      transformOptions: { enableImplicitConversion: true }, // ej: ?page=1 → number
    }),
  );

  // ─── Cierre ordenado (Ctrl+C, SIGTERM) cierra conexiones BD ───
  app.enableShutdownHooks();

  // ─── Swagger: documentación interactiva en /docs ───
  if (appCfg.swaggerEnabled) {
    const swaggerCfg = new DocumentBuilder()
      .setTitle(appCfg.appName)
      .setDescription(
        'API REST de VisionCare AI — Asistencia visual, navegación y ' +
          'entrenamiento para la autonomía de personas con discapacidad visual.',
      )
      .setVersion('0.1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerCfg);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(appCfg.port);

  const logger = new Logger('Bootstrap');
  logger.log(
    `🚀 ${appCfg.appName} escuchando en http://localhost:${appCfg.port}/${appCfg.apiPrefix}`,
  );
  if (appCfg.swaggerEnabled) {
    logger.log(`📚 Swagger disponible en http://localhost:${appCfg.port}/docs`);
  }
  logger.log(`🌍 Entorno: ${appCfg.nodeEnv}`);
}

void bootstrap();