import { Injectable, Logger } from '@nestjs/common';

import type {
  CanalEnvio,
  EstadoEnvio,
} from './entities/destinatario-ayuda.entity';

/**
 * ══════════════════════════════════════════════════════
 * Servicio de NOTIFICACIONES de ayuda — SPRINT 2: SIMULADO.
 *
 * ⚠️ Documentación del hook de producción (Sprint 3 / deploy):
 *
 *   SMS      → Twilio (twilio.messages.create) o gateway local
 *   CORREO   → Nodemailer (@nestjs-modules/mailer) con SMTP
 *   NOTIF.   → FCM / APNs (expo-notifications ya en el stack)
 *
 * La SIMULACIÓN deja traza real en BD (estado ENVIADO +
 * fecha) para probar el flujo completo CU20 sin proveedores,
 * y loguea el contenido exacto que recibiría el contacto.
 *
 * Estrategia recomendada para producción: cola asíncrona
 * (BullMQ) con reintentos — fuera de alcance de S2.
 * ══════════════════════════════════════════════════════
 */

export interface DatosNotificacion {
  canal: CanalEnvio;
  nombreContacto: string;
  telefonoContacto: string | null;
  correoContacto: string | null;
  nombreUsuario: string;
  tipoSolicitud: string;
  mensajeUsuario: string | null;
  urlMapa: string | null;
}

@Injectable()
export class NotificacionesAyudaService {
  private readonly logger = new Logger(NotificacionesAyudaService.name);

  /**
   * "Envía" la notificación y devuelve el resultado.
   * En S2: siempre ENVIADO (simulación determinista —
   * las pruebas E2E no deben ser flaky por azar).
   */
  async enviar(datos: DatosNotificacion): Promise<EstadoEnvio> {
    const cuerpo = this.construirMensaje(datos);

    // ══════════ SIMULACIÓN (Sprint 2) ══════════
    this.logger.log(
      `📨 [SIMULACIÓN ${datos.canal}] → ${datos.nombreContacto} ` +
        `(${datos.canal === 'CORREO' ? datos.correoContacto : datos.telefonoContacto}): ` +
        `${cuerpo}`,
    );
    // ═══════════════════════════════════════════

    // En producción (hooks reales):
    //   try { await this.twilio.send(...); return 'ENVIADO'; }
    //   catch (e) { this.logger.error(...); return 'ERROR'; }

    return 'ENVIADO';
  }

  /**
   * Mensaje que recibe el contacto — el MISMO formato que
   * usará el proveedor real (SMS ≤160 chars, correo completo).
   */
  private construirMensaje(datos: DatosNotificacion): string {
    const urgencia =
      datos.tipoSolicitud === 'EMERGENCIA'
        ? '🚨 EMERGENCIA'
        : '🆘 SOLICITUD DE AYUDA';

    let msg =
      `${urgencia}: ${datos.nombreUsuario} necesita tu ayuda.`;

    if (datos.mensajeUsuario) {
      msg += ` Mensaje: "${datos.mensajeUsuario}".`;
    }

    if (datos.urlMapa) {
      msg += ` Ubicación: ${datos.urlMapa}`;
    } else {
      msg += ' (Sin ubicación disponible)';
    }

    return msg;
  }
}