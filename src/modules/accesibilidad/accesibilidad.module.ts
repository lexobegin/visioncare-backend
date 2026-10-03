import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreferenciaAccesibilidad } from './entities/preferencia-accesibilidad.entity';
import { AccesibilidadController } from './accesibilidad.controller';
import { AccesibilidadService } from './accesibilidad.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de accesibilidad (CU03).
 * Exporta AccesibilidadService: la app móvil y el módulo de
 * voz lo usarán para respetar la configuración del usuario.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [TypeOrmModule.forFeature([PreferenciaAccesibilidad])],

  controllers: [AccesibilidadController],

  providers: [AccesibilidadService],

  exports: [AccesibilidadService],
})
export class AccesibilidadModule {}