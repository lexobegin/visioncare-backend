import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  construirRespuestaPaginada,
  PaginationDto,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { ContactosService } from '../contactos/contactos.service';
import { HistorialService } from '../historial/historial.service';
import { TIPOS_ACTIVIDAD } from '../historial/entities/historial-actividad.entity';
import { Alerta } from '../alertas/entities/alerta.entity';
import type { NivelAlerta } from '../alertas/entities/alerta.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { DestinatarioAyuda, type CanalEnvio } from './entities/destinatario-ayuda.entity';
import {
  EstadoSolicitud,
  SolicitudAyuda,
  type TipoSolicitud,
} from './entities/solicitud-ayuda.entity';
import { Ubicacion } from './entities/ubicacion.entity';
import { CrearSolicitudDto, SolicitudResponseDto } from './dto';
import { NotificacionesAyudaService } from './notificaciones-ayuda.service';

/**
 * Nivel de la alerta interna según el tipo de solicitud.
 */
const NIVEL_POR_TIPO: Record<TipoSolicitud, NivelAlerta> = {
  EMERGENCIA: 'CRITICO',
  AYUDA: 'ALTO',
  ASISTENCIA: 'MEDIO',
};

/**
 * ══════════════════════════════════════════════════════
 * Servicio de ayuda (CU20) — orquestador de emergencias.
 *
 * solicitar():
 *   1. Guarda ubicación GPS (si vino — nunca bloquea)
 *   2. Crea solicitud (PENDIENTE)
 *   3. Contactos ACTIVOS autorizados_emergencias (S1)
 *   4. Destinatario por contacto (SMS/CORREO según medio)
 *   5. Notifica (simulado) → destinatario ENVIADO
 *   6. Solicitud → ENVIADA (o PENDIENTE si nadie notificado)
 *   7. Alerta interna AYUDA_SOLICITADA (web admin) + historial
 *   8. mensaje_voz según resultado (nunca silencio)
 *
 * atender()/cancelar(): estados posteriores.
 * listarPorUsuario(): CU38 web (controller valida roles).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class AyudasService {
  private readonly logger = new Logger(AyudasService.name);

  constructor(
    @InjectRepository(Ubicacion)
    private readonly ubicacionesRepo: Repository<Ubicacion>,
    @InjectRepository(SolicitudAyuda)
    private readonly solicitudesRepo: Repository<SolicitudAyuda>,
    @InjectRepository(DestinatarioAyuda)
    private readonly destinatariosRepo: Repository<DestinatarioAyuda>,
    @InjectRepository(Alerta)
    private readonly alertasRepo: Repository<Alerta>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly contactosService: ContactosService,
    private readonly notificaciones: NotificacionesAyudaService,
    private readonly historialService: HistorialService,
  ) {}

  // ═══════════════════ SOLICITAR (CU20) ═══════════════════

  async solicitar(
    idUsuario: number,
    dto: CrearSolicitudDto,
  ): Promise<SolicitudResponseDto> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id_usuario: idUsuario },
      relations: { perfil: true },
    });
    const nombreUsuario =
      usuario?.perfil?.nombres ?? usuario?.correo ?? 'El usuario';

    // ─── 1. Ubicación GPS (si vino) ───
    let idUbicacion: number | null = null;
    if (dto.latitud !== undefined && dto.longitud !== undefined) {
      const ubicacion = await this.ubicacionesRepo.save(
        this.ubicacionesRepo.create({
          id_usuario: idUsuario,
          latitud: dto.latitud,
          longitud: dto.longitud,
          precision_metros: dto.precision_metros ?? null,
        }),
      );
      idUbicacion = Number(ubicacion.id_ubicacion);
    }

    // ─── 2. Solicitud (PENDIENTE) ───
    const solicitud = await this.solicitudesRepo.save(
      this.solicitudesRepo.create({
        id_usuario: idUsuario,
        id_ubicacion: idUbicacion,
        tipo: dto.tipo,
        mensaje: dto.mensaje ?? null,
        estado: 'PENDIENTE' as EstadoSolicitud,
      }),
    );
    const idSolicitud = Number(solicitud.id_solicitud);

    // ─── 3. Contactos autorizados (prioridad ASC — S1) ───
    const contactos = await this.contactosService.obtenerAutorizadosEmergencia(
      idUsuario,
    );

    const urlMapa = this.construirUrlMapa(dto.latitud, dto.longitud);

    // ─── 4-5. Destinatarios + notificación ───
    const notificados: { nombre: string; canal: CanalEnvio }[] = [];

    for (const contacto of contactos) {
      // Canal: SMS si tiene teléfono; CORREO si solo correo
      const canal: CanalEnvio = contacto.telefono ? 'SMS' : 'CORREO';

      const destinatario = await this.destinatariosRepo.save(
        this.destinatariosRepo.create({
          id_solicitud: idSolicitud,
          id_contacto: Number(contacto.id_contacto),
          canal,
          estado_envio: 'PENDIENTE',
        }),
      );

      const estado = await this.notificaciones.enviar({
        canal,
        nombreContacto: contacto.nombre,
        telefonoContacto: contacto.telefono,
        correoContacto: contacto.correo,
        nombreUsuario,
        tipoSolicitud: dto.tipo,
        mensajeUsuario: dto.mensaje ?? null,
        urlMapa,
      });

      await this.destinatariosRepo.update(destinatario.id_destinatario, {
        estado_envio: estado,
        fecha_envio: new Date(),
      });

      if (estado === 'ENVIADO' || estado === 'RECIBIDO') {
        notificados.push({ nombre: contacto.nombre, canal });
      }
    }

    // ─── 6. Estado final de la solicitud ───
    const estadoFinal: EstadoSolicitud =
      notificados.length > 0 ? 'ENVIADA' : 'PENDIENTE';
    await this.solicitudesRepo.update(idSolicitud, {
      estado: estadoFinal,
    });

    // ─── 7. Alerta interna (web admin) + historial ───
    await this.alertasRepo.save(
      this.alertasRepo.create({
        id_usuario: idUsuario,
        tipo_alerta: 'AYUDA_SOLICITADA',
        nivel: NIVEL_POR_TIPO[dto.tipo],
        mensaje:
          `${nombreUsuario} solicitó ${dto.tipo}. ` +
          (notificados.length > 0
            ? `Notificados: ${notificados.map((n) => n.nombre).join(', ')}.`
            : 'SIN contactos de confianza notificados.'),
        prioridad: dto.tipo === 'EMERGENCIA' ? 5 : 4,
        canal: 'VOZ',
        atendida: false,
      }),
    );

    await this.historialService.registrar(
      idUsuario,
      TIPOS_ACTIVIDAD.AYUDA_SOLICITADA,
      idSolicitud,
      `Solicitud de ${dto.tipo.toLowerCase()} enviada a ${notificados.length} contacto(s).`,
    );

    this.logger.log(
      `🚨 ${dto.tipo} (usuario ${idUsuario}): ${notificados.length}/${contactos.length} notificados.`,
    );

    // ─── 8. Respuesta con voz ───
    const mensajeVoz =
      notificados.length > 0
        ? `${dto.tipo === 'EMERGENCIA' ? 'Emergencia' : 'Ayuda'} solicitada. ` +
          `Se notificó a ${notificados.length} ${notificados.length === 1 ? 'contacto' : 'contactos'} de confianza.`
        : 'Solicitaste ayuda, pero no tienes contactos de confianza activos. ' +
          'Pídele a alguien que te ayude a agregarlos en la sección Contactos.';

    return this.armarRespuesta(
      await this.obtenerEntidadCompleta(idSolicitud, idUsuario),
      mensajeVoz,
    );
  }

  // ═══════════════════ CONSULTAS ═══════════════════

  /** Mis solicitudes (paginado) — con destinatarios incluidos */
  async listar(
    idUsuario: number,
    paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<SolicitudResponseDto>> {
    const qb = this.solicitudesRepo
      .createQueryBuilder('solicitud')
      .where('solicitud.id_usuario = :idUsuario', { idUsuario })
      .orderBy('solicitud.fecha_solicitud', 'DESC')
      .skip(paginacion.skip)
      .take(paginacion.take);

    const [solicitudes, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      await Promise.all(
        solicitudes.map((s) => this.armarRespuesta(s, null)),
      ),
      total,
      paginacion,
    );
  }

  /** CU38 — Solicitudes de otro usuario (web, roles en controller) */
  async listarPorUsuario(
    idUsuarioObjetivo: number,
    paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<SolicitudResponseDto>> {
    const existe = await this.usuariosRepo.exist({
      where: { id_usuario: idUsuarioObjetivo },
    });
    if (!existe) {
      throw new NotFoundException(
        `Usuario con id ${idUsuarioObjetivo} no encontrado.`,
      );
    }
    return this.listar(idUsuarioObjetivo, paginacion);
  }

  /** Detalle con destinatarios + ubicación */
  async obtenerPorId(
    idSolicitud: number,
    idUsuario: number,
  ): Promise<SolicitudResponseDto> {
    const solicitud = await this.obtenerEntidadCompleta(
      idSolicitud,
      idUsuario,
    );
    return this.armarRespuesta(solicitud, null);
  }

  // ═══════════════ ATENDER / CANCELAR ═══════════════

  /** Marca la solicitud como ATENDIDA (el usuario confirma que le ayudaron) */
  async atender(
    idSolicitud: number,
    idUsuario: number,
  ): Promise<{ mensaje: string }> {
    const solicitud = await this.buscarPropia(idSolicitud, idUsuario);

    if (solicitud.estado === 'CANCELADA' || solicitud.estado === 'ATENDIDA') {
      throw new NotFoundException(
        `La solicitud ${idSolicitud} ya está ${solicitud.estado.toLowerCase()}.`,
      );
    }

    await this.solicitudesRepo.update(idSolicitud, {
      estado: 'ATENDIDA',
      fecha_resolucion: new Date(),
    });

    return { mensaje: `Solicitud ${idSolicitud} marcada como atendida.` };
  }

  /** Cancela (solo si no está atendida — activar por error) */
  async cancelar(
    idSolicitud: number,
    idUsuario: number,
  ): Promise<{ mensaje: string }> {
    const solicitud = await this.buscarPropia(idSolicitud, idUsuario);

    if (solicitud.estado === 'ATENDIDA') {
      throw new NotFoundException(
        `La solicitud ${idSolicitud} ya fue atendida y no puede cancelarse.`,
      );
    }
    if (solicitud.estado === 'CANCELADA') {
      return { mensaje: `La solicitud ${idSolicitud} ya estaba cancelada.` };
    }

    await this.solicitudesRepo.update(idSolicitud, {
      estado: 'CANCELADA',
      fecha_resolucion: new Date(),
    });

    return { mensaje: `Solicitud ${idSolicitud} cancelada.` };
  }

  // ═══════════════════ HELPERS ═══════════════════

  private construirUrlMapa(
    latitud?: number,
    longitud?: number,
  ): string | null {
    if (latitud === undefined || longitud === undefined) return null;
    return `https://maps.google.com/?q=${latitud},${longitud}`;
  }

  private async obtenerEntidadCompleta(
    idSolicitud: number,
    idUsuario: number,
  ): Promise<SolicitudAyuda> {
    const solicitud = await this.solicitudesRepo.findOne({
      where: { id_solicitud: idSolicitud },
      relations: { ubicacion: true, destinatarios: true },
    });

    // 404 si no existe o es de otro usuario (no filtra existencia)
    if (
      !solicitud ||
      Number(solicitud.id_usuario) !== Number(idUsuario)
    ) {
      throw new NotFoundException(
        `Solicitud con id ${idSolicitud} no encontrada.`,
      );
    }
    return solicitud;
  }

  private async buscarPropia(
    idSolicitud: number,
    idUsuario: number,
  ): Promise<SolicitudAyuda> {
    return this.obtenerEntidadCompleta(idSolicitud, idUsuario);
  }

  /** Entidad (con relaciones) → DTO público */
  private armarRespuesta(
    solicitud: SolicitudAyuda,
    mensajeVoz: string | null,
  ): SolicitudResponseDto {
    return {
      id_solicitud: Number(solicitud.id_solicitud),
      id_usuario: Number(solicitud.id_usuario),
      id_ubicacion:
        solicitud.id_ubicacion !== null
          ? Number(solicitud.id_ubicacion)
          : null,
      tipo: solicitud.tipo,
      mensaje: solicitud.mensaje,
      estado: solicitud.estado,
      fecha_solicitud: solicitud.fecha_solicitud,
      fecha_resolucion: solicitud.fecha_resolucion,
      ubicacion: solicitud.ubicacion
        ? {
            latitud: Number(solicitud.ubicacion.latitud),
            longitud: Number(solicitud.ubicacion.longitud),
            precision_metros:
              solicitud.ubicacion.precision_metros !== null
                ? Number(solicitud.ubicacion.precision_metros)
                : null,
          }
        : null,
      url_mapa: solicitud.ubicacion
        ? this.construirUrlMapa(
            Number(solicitud.ubicacion.latitud),
            Number(solicitud.ubicacion.longitud),
          )
        : null,
      destinatarios: solicitud.destinatarios?.map((d) => ({
        id_destinatario: Number(d.id_destinatario),
        id_contacto: Number(d.id_contacto),
        nombre_contacto: d.contacto?.nombre ?? `#${d.id_contacto}`,
        canal: d.canal,
        estado_envio: d.estado_envio,
        fecha_envio: d.fecha_envio,
      })),
      mensaje_voz: mensajeVoz,
    };
  }
}