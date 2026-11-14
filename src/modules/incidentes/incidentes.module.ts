import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HistorialModule } from '../historial/historial.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Ubicacion } from '../ayuda/entities/ubicacion.entity';
import { Incidente } from './entities/incidente.entity';
import { EvidenciaIncidente } from './entities/evidencia-incidente.entity';
import { IncidentesController } from './incidentes.controller';
import { IncidentesService } from './incidentes.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de incidentes (CU22 móvil · CU38 web).
 *
 * Imports necesarios:
 *   - HistorialModule → HistorialService (eventos INCIDENTE_*)
 * R2Service es GLOBAL (ArchivosModule): se inyecta directo.
 * Ubicacion/Usuario se registran en forFeature para reuso.
 *
 * Exporta IncidentesService: reportes (CU39) lo reutilizará.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Incidente, EvidenciaIncidente, Ubicacion, Usuario]),
    HistorialModule,
  ],

  controllers: [IncidentesController],

  providers: [IncidentesService],

  exports: [IncidentesService],
})
export class IncidentesModule {}
