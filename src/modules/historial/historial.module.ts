import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { HistorialActividad } from './entities/historial-actividad.entity';
import { HistorialController } from './historial.controller';
import { HistorialService } from './historial.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de historial de actividades (CU37 / base CU23).
 * Exporta HistorialService: auth, usuarios y los módulos de
 * los Sprints 2-3 registran eventos a través de él.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [TypeOrmModule.forFeature([HistorialActividad, Usuario])],

  controllers: [HistorialController],

  providers: [HistorialService],

  exports: [HistorialService],
})
export class HistorialModule {}