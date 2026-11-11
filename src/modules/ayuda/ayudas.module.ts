import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AlertasModule } from '../alertas/alertas.module';
import { ContactosModule } from '../contactos/contactos.module';
import { HistorialModule } from '../historial/historial.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { DestinatarioAyuda } from './entities/destinatario-ayuda.entity';
import { SolicitudAyuda } from './entities/solicitud-ayuda.entity';
import { Ubicacion } from './entities/ubicacion.entity';
import { AyudasController } from './ayudas.controller';
import { AyudasService } from './ayudas.service';
import { NotificacionesAyudaService } from './notificaciones-ayuda.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de ayuda (CU20).
 *
 * Imports necesarios:
 *   - AlertasModule  → Repository<Alerta> (alerta interna)
 *   - ContactosModule→ ContactosService (autorizados emergencia)
 *   - HistorialModule→ HistorialService (evento AYUDA_SOLICITADA)
 *
 * Exporta AyudasService: el módulo de navegación/seguridad
 * (Sprint 3: compartir ubicación CU21) lo reutilizará.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Ubicacion, SolicitudAyuda, DestinatarioAyuda, Usuario]),
    AlertasModule,
    ContactosModule,
    HistorialModule,
  ],

  controllers: [AyudasController],

  providers: [AyudasService, NotificacionesAyudaService],

  exports: [AyudasService],
})
export class AyudasModule {}