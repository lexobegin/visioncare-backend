import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  construirRespuestaPaginada,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { UsuarioJwt } from '../../common/decorators';
import { HistorialService } from '../historial/historial.service';
import { TIPOS_ACTIVIDAD } from '../historial/entities/historial-actividad.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Ubicacion } from '../ayuda/entities/ubicacion.entity';
import { R2Service } from '../archivos/r2.service';
import {
  EstadoIncidente,
  Incidente,
  SeveridadIncidente,
} from './entities/incidente.entity';
import {
  EvidenciaIncidente,
  TipoArchivoEvidencia,
} from './entities/evidencia-incidente.entity';
import {
  ActualizarIncidenteDto,
  CrearIncidenteDto,
  IncidenteQueryDto,
  IncidenteResponseDto,
} from './dto';

/** Máximo de evidencias aceptadas por petición (coincide con el controller) */
const MAX_EVIDENCIAS = 5;

/** MIME → tipo_archivo para la BD (el MIME ya fue validado en el controller) */
function tipoArchivoPorMime(mime: string): TipoArchivoEvidencia {
  if (mime.startsWith('image/')) return 'IMAGEN';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENTO';
}

/**
 * ══════════════════════════════════════════════════════
 * Servicio de incidentes (CU22 móvil · CU38 web).
 *
 * crear():
 *   1. Guarda ubicación GPS (si vino — nunca bloquea)
 *   2. Crea incidente (ABIERTO, severidad según dto)
 *   3. Sube evidencias a R2 (best-effort: si falla una,
 *      continúa con las demás — el reporte nunca se pierde)
 *   4. Historial INCIDENTE_REGISTRADO
 *   5. Respuesta con mensaje_voz (TTS)
 *
 * actualizarEstado(): móvil cierra (RESUELTO) o reabre;
 *   web (ADMIN/INSTITUCION) gestiona el ciclo completo.
 * agregarEvidencia() / eliminarEvidencia(): ajuste post-reporte.
 * listarPorUsuario(): CU38 web (controller valida roles).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class IncidentesService {
  private readonly logger = new Logger(IncidentesService.name);

  constructor(
    @InjectRepository(Incidente)
    private readonly incidentesRepo: Repository<Incidente>,
    @InjectRepository(EvidenciaIncidente)
    private readonly evidenciasRepo: Repository<EvidenciaIncidente>,
    @InjectRepository(Ubicacion)
    private readonly ubicacionesRepo: Repository<Ubicacion>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly r2Service: R2Service,
    private readonly historialService: HistorialService,
  ) {}

  // ═══════════════════ CREAR (CU22) ═══════════════════

  async crear(
    idUsuario: number,
    dto: CrearIncidenteDto,
    archivos: Express.Multer.File[],
  ): Promise<IncidenteResponseDto> {
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

    // ─── 2. Incidente (ABIERTO) ───
    const incidente = await this.incidentesRepo.save(
      this.incidentesRepo.create({
        id_usuario: idUsuario,
        id_ubicacion: idUbicacion,
        tipo_incidente: dto.tipo_incidente,
        descripcion: dto.descripcion ?? null,
        severidad: (dto.severidad ?? 'MEDIA') as SeveridadIncidente,
        estado: 'ABIERTO' as EstadoIncidente,
      }),
    );
    const idIncidente = Number(incidente.id_incidente);

    // ─── 3. Evidencias a R2 (best-effort, una por una) ───
    let evidenciasGuardadas = 0;
    for (const archivo of (archivos ?? []).slice(0, MAX_EVIDENCIAS)) {
      try {
        const subido = await this.r2Service.subirArchivo(
          idUsuario,
          archivo.buffer,
          archivo.mimetype,
          'evidencias',
        );
        await this.evidenciasRepo.insert({
          id_incidente: idIncidente,
          tipo_archivo: tipoArchivoPorMime(archivo.mimetype),
          nombre_archivo: archivo.originalname ?? null,
          r2_key: subido.r2_key,
          mime_type: archivo.mimetype,
          tamano_bytes: archivo.size ?? null,
        });
        evidenciasGuardadas++;
      } catch (error) {
        // El reporte nunca se pierde por una evidencia fallida
        this.logger.warn(
          `Evidencia omitida para incidente ${idIncidente}: ${error}`,
        );
      }
    }

    // ─── 4. Historial (best-effort) ───
    await this.historialService.registrar(
      idUsuario,
      TIPOS_ACTIVIDAD.INCIDENTE_REGISTRADO,
      idIncidente,
      `Incidente '${dto.tipo_incidente}' con severidad ${(dto.severidad ?? 'MEDIA').toLowerCase()} y ${evidenciasGuardadas} evidencia(s).`,
    );

    this.logger.log(
      `⚠️ Incidente ${idIncidente} (${dto.tipo_incidente}) del usuario ${idUsuario}: ${evidenciasGuardadas} evidencia(s).`,
    );

    // ─── 5. Respuesta con voz ───
    const mensajeVoz =
      `Incidente registrado: ${dto.tipo_incidente}. ` +
      (evidenciasGuardadas > 0
        ? `Se guardaron ${evidenciasGuardadas} ${evidenciasGuardadas === 1 ? 'evidencia' : 'evidencias'}.`
        : 'Sin evidencias adjuntas.');

    return this.armarRespuesta(
      await this.obtenerEntidadCompleta(idIncidente),
      mensajeVoz,
    );
  }

  // ═══════════════════ CONSULTAS ═══════════════════

  /** Mis incidentes (móvil CU22), reciente primero */
  async listar(
    idUsuario: number,
    query: IncidenteQueryDto,
  ): Promise<RespuestaPaginada<IncidenteResponseDto>> {
    return this.listarFiltrado(idUsuario, query);
  }

  /** CU38 — Incidentes de un usuario (web, roles en controller) */
  async listarPorUsuario(
    idUsuarioObjetivo: number,
    query: IncidenteQueryDto,
  ): Promise<RespuestaPaginada<IncidenteResponseDto>> {
    const existe = await this.usuariosRepo.exist({
      where: { id_usuario: idUsuarioObjetivo },
    });
    if (!existe) {
      throw new NotFoundException(
        `Usuario con id ${idUsuarioObjetivo} no encontrado.`,
      );
    }
    return this.listarFiltrado(idUsuarioObjetivo, query);
  }

  /** Detalle — dueño, o ADMIN/INSTITUCION (CU38) */
  async obtenerPorId(
    idIncidente: number,
    usuario: UsuarioJwt,
  ): Promise<IncidenteResponseDto> {
    const incidente = await this.buscarConPermisos(idIncidente, usuario);
    return this.armarRespuesta(incidente, null);
  }

  // ═══════════════════ ESTADO (CU22 + CU38) ═══════════════════

  /**
   * Cambia estado (y severidad, solo gestores) de un incidente.
   * - ADMIN/INSTITUCION: ciclo completo (EN_REVISION → RESUELTO/CERRADO).
   * - USUARIO dueño: solo RESUELTO ("ya se resolvió") o reabrir (ABIERTO),
   *   y no puede tocar la severidad.
   */
  async actualizarEstado(
    idIncidente: number,
    dto: ActualizarIncidenteDto,
    usuario: UsuarioJwt,
  ): Promise<IncidenteResponseDto> {
    const incidente = await this.buscarConPermisos(idIncidente, usuario);
    const esGestor = usuario.rol === 'ADMIN' || usuario.rol === 'INSTITUCION';

    if (!esGestor) {
      if (dto.severidad) {
        throw new ForbiddenException(
          'Solo ADMIN o INSTITUCION puede cambiar la severidad.',
        );
      }
      if (dto.estado !== 'RESUELTO' && dto.estado !== 'ABIERTO') {
        throw new ForbiddenException(
          'Como usuario solo puedes marcar el incidente como RESUELTO ' +
            'o reabrirlo (ABIERTO).',
        );
      }
    }

    const fechaCierre =
      dto.estado === 'RESUELTO' || dto.estado === 'CERRADO'
        ? new Date()
        : null;

    await this.incidentesRepo.update(idIncidente, {
      estado: dto.estado,
      ...(esGestor && dto.severidad ? { severidad: dto.severidad } : {}),
      fecha_cierre: fechaCierre,
    });

    await this.historialService.registrar(
      Number(incidente.id_usuario),
      TIPOS_ACTIVIDAD.INCIDENTE_ACTUALIZADO,
      idIncidente,
      `Incidente '${incidente.tipo_incidente}' pasó a ${dto.estado}.`,
    );

    this.logger.log(
      `Incidente ${idIncidente} → ${dto.estado} (por ${usuario.rol} ${usuario.id_usuario}).`,
    );

    return this.armarRespuesta(
      await this.obtenerEntidadCompleta(idIncidente),
      `Incidente actualizado. Estado: ${dto.estado.toLowerCase().replace('_', ' ')}.`,
    );
  }

  // ═══════════════════ EVIDENCIAS ═══════════════════

  /** Agrega una evidencia a un incidente propio (o gestionado) */
  async agregarEvidencia(
    idIncidente: number,
    archivo: Express.Multer.File,
    usuario: UsuarioJwt,
  ): Promise<IncidenteResponseDto> {
    await this.buscarConPermisos(idIncidente, usuario);

    const subido = await this.r2Service.subirArchivo(
      Number(usuario.id_usuario),
      archivo.buffer,
      archivo.mimetype,
      'evidencias',
    );

    await this.evidenciasRepo.insert({
      id_incidente: idIncidente,
      tipo_archivo: tipoArchivoPorMime(archivo.mimetype),
      nombre_archivo: archivo.originalname ?? null,
      r2_key: subido.r2_key,
      mime_type: archivo.mimetype,
      tamano_bytes: archivo.size ?? null,
    });

    return this.armarRespuesta(
      await this.obtenerEntidadCompleta(idIncidente),
      'Evidencia agregada al incidente.',
    );
  }

  /** Elimina una evidencia (R2 best-effort + fila) */
  async eliminarEvidencia(
    idIncidente: number,
    idEvidencia: number,
    usuario: UsuarioJwt,
  ): Promise<IncidenteResponseDto> {
    await this.buscarConPermisos(idIncidente, usuario);

    const evidencia = await this.evidenciasRepo.findOne({
      where: {
        id_evidencia: idEvidencia,
        id_incidente: idIncidente,
      },
    });
    if (!evidencia) {
      throw new NotFoundException(
        `Evidencia con id ${idEvidencia} no encontrada en el incidente ${idIncidente}.`,
      );
    }

    await this.r2Service.eliminar(evidencia.r2_key);
    await this.evidenciasRepo.delete(evidencia.id_evidencia);

    return this.armarRespuesta(
      await this.obtenerEntidadCompleta(idIncidente),
      'Evidencia eliminada del incidente.',
    );
  }

  // ═══════════════════ HELPERS ═══════════════════

  /** Listado paginado con filtros estado/severidad/buscar */
  private async listarFiltrado(
    idUsuario: number,
    query: IncidenteQueryDto,
  ): Promise<RespuestaPaginada<IncidenteResponseDto>> {
    const qb = this.incidentesRepo
      .createQueryBuilder('incidente')
      .leftJoinAndSelect('incidente.evidencias', 'evidencias')
      .leftJoinAndSelect('incidente.ubicacion', 'ubicacion')
      .where('incidente.id_usuario = :idUsuario', { idUsuario })
      .orderBy('incidente.fecha_incidente', 'DESC')
      .skip(query.skip)
      .take(query.take);

    if (query.estado) {
      qb.andWhere('incidente.estado = :estado', { estado: query.estado });
    }
    if (query.severidad) {
      qb.andWhere('incidente.severidad = :severidad', {
        severidad: query.severidad,
      });
    }
    if (query.buscar) {
      qb.andWhere(
        '(incidente.tipo_incidente ILIKE :buscar OR incidente.descripcion ILIKE :buscar)',
        { buscar: `%${query.buscar}%` },
      );
    }

    const [incidentes, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      incidentes.map((i) => this.armarRespuesta(i, null)),
      total,
      query,
    );
  }

  /** Carga el incidente con ubicación + evidencias (404 si no existe) */
  private async obtenerEntidadCompleta(
    idIncidente: number,
  ): Promise<Incidente> {
    const incidente = await this.incidentesRepo.findOne({
      where: { id_incidente: idIncidente },
      relations: { ubicacion: true, evidencias: true },
    });
    if (!incidente) {
      throw new NotFoundException(
        `Incidente con id ${idIncidente} no encontrado.`,
      );
    }
    return incidente;
  }

  /** 404 si no existe o (para USUARIO) es ajeno; gestores ven todo */
  private async buscarConPermisos(
    idIncidente: number,
    usuario: UsuarioJwt,
  ): Promise<Incidente> {
    const incidente = await this.obtenerEntidadCompleta(idIncidente);

    const esGestor = usuario.rol === 'ADMIN' || usuario.rol === 'INSTITUCION';
    if (!esGestor && Number(incidente.id_usuario) !== Number(usuario.id_usuario)) {
      // Ajeno → mismo mensaje que inexistente (no filtra existencia)
      throw new NotFoundException(
        `Incidente con id ${idIncidente} no encontrado.`,
      );
    }
    return incidente;
  }

  /** Entidad (con relaciones) → DTO público */
  private armarRespuesta(
    incidente: Incidente,
    mensajeVoz: string | null,
  ): IncidenteResponseDto {
    return {
      id_incidente: Number(incidente.id_incidente),
      id_usuario: Number(incidente.id_usuario),
      id_ubicacion:
        incidente.id_ubicacion !== null
          ? Number(incidente.id_ubicacion)
          : null,
      tipo_incidente: incidente.tipo_incidente,
      descripcion: incidente.descripcion,
      severidad: incidente.severidad,
      estado: incidente.estado,
      fecha_incidente: incidente.fecha_incidente,
      fecha_cierre: incidente.fecha_cierre,
      ubicacion: incidente.ubicacion
        ? {
            latitud: Number(incidente.ubicacion.latitud),
            longitud: Number(incidente.ubicacion.longitud),
            precision_metros:
              incidente.ubicacion.precision_metros !== null
                ? Number(incidente.ubicacion.precision_metros)
                : null,
          }
        : null,
      url_mapa: incidente.ubicacion
        ? `https://maps.google.com/?q=${incidente.ubicacion.latitud},${incidente.ubicacion.longitud}`
        : null,
      evidencias: incidente.evidencias?.map((e) => ({
        id_evidencia: Number(e.id_evidencia),
        tipo_archivo: e.tipo_archivo,
        nombre_archivo: e.nombre_archivo,
        mime_type: e.mime_type,
        tamano_bytes: e.tamano_bytes !== null ? Number(e.tamano_bytes) : null,
        fecha_registro: e.fecha_registro,
        url_publica: this.r2Service.construirUrl(e.r2_key),
      })),
      mensaje_voz: mensajeVoz,
    };
  }
}
