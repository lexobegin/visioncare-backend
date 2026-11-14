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

// ─── Sprint 3 — CU21 (compartir ubicación autorizada) ───
import { UbicacionesController } from './ubicaciones.controller';
import { UbicacionesService } from './ubicaciones.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de ayuda (CU20 + CU21 Sprint 3).
 *
 * Imports necesarios:
 *   - AlertasModule  → Repository<Alerta> (alerta interna)
 *   - ContactosModule→ ContactosService (autorizados emergencia)
 *   - HistorialModule→ HistorialService (evento AYUDA_SOLICITADA)
 *
 * Exporta AyudasService: el módulo de navegación/seguridad
 * lo reutilizará.
 *
 * Sprint 3 (CU21): UbicacionesController/Service — el móvil
 * envía pings GPS (asistente continuo o toggle) y el mapa web
 * de ADMIN/INSTITUCION muestra a los usuarios "en vivo" con
 * llamadas al usuario y a sus contactos autorizados.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Ubicacion, SolicitudAyuda, DestinatarioAyuda, Usuario]),
    AlertasModule,
    ContactosModule,
    HistorialModule,
  ],

  controllers: [AyudasController, UbicacionesController],

  providers: [AyudasService, NotificacionesAyudaService, UbicacionesService],

  exports: [AyudasService],
})
export class AyudasModule {}
