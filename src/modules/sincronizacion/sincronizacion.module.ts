import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Usuario } from '../usuarios/entities/usuario.entity';
import { Navegacion } from '../navegacion/entities/navegacion.entity';
import { PuntoNavegacion } from '../navegacion/entities/punto-navegacion.entity';
import { Sincronizacion } from './entities/sincronizacion.entity';
import { SincronizacionController } from './sincronizacion.controller';
import { SincronizacionService } from './sincronizacion.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de sincronización offline (CU25–CU26).
 *
 * Necesita las entidades de navegación (subida/bajada de la
 * traza offline) y usuarios. El historial del lote se inserta
 * con SQL directo (tabla historial_actividades).
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sincronizacion,
      Navegacion,
      PuntoNavegacion,
      Usuario,
    ]),
  ],

  controllers: [SincronizacionController],

  providers: [SincronizacionService],

  exports: [SincronizacionService],
})
export class SincronizacionModule {}
