import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HistorialModule } from '../historial/historial.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Navegacion } from './entities/navegacion.entity';
import { PuntoNavegacion } from './entities/punto-navegacion.entity';
import { NavegacionController } from './navegacion.controller';
import { NavegacionService } from './navegacion.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de navegación asistida (CU24).
 *
 * Imports necesarios:
 *   - HistorialModule → HistorialService (NAVEGACION_*)
 * Exporta NavegacionService: sincronización offline (CU25)
 * lo reutilizará para registrar navegaciones del móvil.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Navegacion, PuntoNavegacion, Usuario]),
    HistorialModule,
  ],

  controllers: [NavegacionController],

  providers: [NavegacionService],

  exports: [NavegacionService],
})
export class NavegacionModule {}
