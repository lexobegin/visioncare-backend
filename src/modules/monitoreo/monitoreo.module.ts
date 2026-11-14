import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModeloIa } from './entities/modelo-ia.entity';
import { RegistroIa } from './entities/registro-ia.entity';
import { MonitoreoController } from './monitoreo.controller';
import { MonitoreoService } from './monitoreo.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de monitoreo IA (CU40): lectura de `modelos_ia` y
 * `registros_ia` — tablas gestionadas por el servicio FastAPI.
 *
 * Exporta MonitoreoService: el módulo de reportes (CU39) lo
 * reutilizará para las estadísticas de uso de IA.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [TypeOrmModule.forFeature([ModeloIa, RegistroIa])],
  controllers: [MonitoreoController],
  providers: [MonitoreoService],
  exports: [MonitoreoService],
})
export class MonitoreoModule {}
