import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HistorialModule } from '../historial/historial.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CategoriaVc } from './entities/categoria.entity';
import { EjercicioVc } from './entities/ejercicio.entity';
import { SesionVc } from './entities/sesion.entity';
import { ResultadoVc } from './entities/resultado.entity';
import { ProgresoVc } from './entities/progreso.entity';
import { DesafioVc } from './entities/desafio.entity';
import { InsigniaVc } from './entities/insignia.entity';
import { UsuarioInsigniaVc } from './entities/usuario-insignia.entity';
import { VisioncoachController } from './visioncoach.controller';
import { VisioncoachService } from './visioncoach.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de VisionCoach (CU27–CU33): catálogo, sesiones,
 * resultados, progreso, desafíos adaptativos e insignias.
 *
 * Imports necesarios:
 *   - HistorialModule → HistorialService (EJERCICIO_COMPLETADO)
 * Exporta VisioncoachService: reportes (CU39) lo reutilizará
 * para las estadísticas de entrenamiento.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoriaVc,
      EjercicioVc,
      SesionVc,
      ResultadoVc,
      ProgresoVc,
      DesafioVc,
      InsigniaVc,
      UsuarioInsigniaVc,
      Usuario,
    ]),
    HistorialModule,
  ],

  controllers: [VisioncoachController],

  providers: [VisioncoachService],

  exports: [VisioncoachService],
})
export class VisioncoachModule {}
