import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComandoVoz } from './entities/comando-voz.entity';
import { VozController } from './voz.controller';
import { VozService } from './voz.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de comandos de voz (CU06).
 * Exporta VozService: el módulo de historial (Sprint 3) lo
 * consultará para consolidar actividades.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [TypeOrmModule.forFeature([ComandoVoz])],

  controllers: [VozController],

  providers: [VozService],

  exports: [VozService],
})
export class VozModule {}