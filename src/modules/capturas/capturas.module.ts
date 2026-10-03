import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapturaEntorno } from './entities/captura-entorno.entity';
import { DeteccionIA } from './entities/deteccion-ia.entity';
import { CapturasController } from './capturas.controller';
import { CapturasService } from './capturas.service';
import { VisionIaClient } from './vision-ia.client';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de capturas de entorno (CU07, CU08).
 * R2Service se inyecta desde ArchivosModule (global).
 * Exporta CapturasService: el módulo de historial y el de
 * alertas (Sprint 2-3) consultaran capturas/detecciones.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [TypeOrmModule.forFeature([CapturaEntorno, DeteccionIA])],

  controllers: [CapturasController],

  providers: [CapturasService, VisionIaClient],

  exports: [CapturasService],
})
export class CapturasModule {}