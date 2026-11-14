import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HistorialModule } from '../historial/historial.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Reporte } from './entities/reporte.entity';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de reportes (CU39): generación JSON/CSV, listado,
 * detalle, descarga y eliminación.
 *
 * Imports necesarios:
 *   - HistorialModule → HistorialService (REPORTE_GENERADO)
 *   - R2Service es GLOBAL (subida/URL/eliminación del CSV)
 * Exporta ReportesService: pruebas de integración (T10).
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Reporte, Usuario]),
    HistorialModule,
  ],

  controllers: [ReportesController],

  providers: [ReportesService],

  exports: [ReportesService],
})
export class ReportesModule {}
