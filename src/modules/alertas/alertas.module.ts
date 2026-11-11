import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Usuario } from '../usuarios/entities/usuario.entity';
import { Alerta } from './entities/alerta.entity';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';
import { PriorizacionService } from './priorizacion.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de alertas (HU17/HU18/HU19 + vista web CU38).
 *
 * EXPORTA:
 *   - AlertasService      → módulos que notifiquen alertas
 *                           (ayuda, Sprint 3)
 *   - PriorizacionService → el cerebro HU17 (consumido por
 *                           capturas/AnalisisContinuoService)
 *   - TypeOrmModule       → expone Repository<Alerta> para
 *                           capturas (persistencia de alertas)
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [TypeOrmModule.forFeature([Alerta, Usuario])],

  controllers: [AlertasController],

  providers: [AlertasService, PriorizacionService],

  exports: [AlertasService, PriorizacionService, TypeOrmModule],
})
export class AlertasModule {}