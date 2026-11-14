import {
  BadRequestException,
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
import { HistorialService } from '../historial/historial.service';
import { TIPOS_ACTIVIDAD } from '../historial/entities/historial-actividad.entity';
import { R2Service } from '../archivos/r2.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Reporte, TIPOS_REPORTE, TipoReporte } from './entities/reporte.entity';
import {
  DescargaReporteDto,
  GenerarReporteDto,
  ReporteQueryDto,
  ReporteResponseDto,
} from './dto';

/** Fechas límite cuando no se envía periodo (histórico completo) */
const INICIO_HISTORICO = '1970-01-01';
const FIN_HISTORICO = '2100-12-31';

const LABELS: Record<TipoReporte, string> = {
  USO_APLICACION: 'Reporte de uso de la aplicación',
  PROGRESO_VISIONCOACH: 'Reporte de progreso VisionCoach',
  INCIDENTES: 'Reporte de incidentes',
  MONITOREO_IA: 'Reporte de monitoreo de IA',
};

type Fila = Record<string, unknown>;
type Metricas = Record<string, unknown>;

/**
 * ══════════════════════════════════════════════════════
 * Servicio de reportes (CU39 — web).
 *
 * generar(): calcula métricas con SQL agregado y guarda el
 *   JSONB en `reportes.datos`; si formato CSV, arma el archivo
 *   (con BOM para Excel) y lo sube a R2 (carpeta `reportes`).
 *   Alcance: ADMIN → global o la institución que pida;
 *   INSTITUCION → siempre la suya.
 * listar()/obtenerPorId(): ADMIN ve todo; INSTITUCION ve lo de
 *   su institución o lo que ella misma generó.
 * descargar(): URL pública del CSV en R2 (si lo tiene).
 * eliminar(): solo ADMIN (borra fila y CSV best-effort).
 *
 * Formatos PDF/XLSX: contrato listo, implementación en una
 * versión futura (devuelven 400 con mensaje claro).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);

  constructor(
    @InjectRepository(Reporte)
    private readonly reportesRepo: Repository<Reporte>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly r2Service: R2Service,
    private readonly historialService: HistorialService,
  ) {}

  // ═══════════════════ GENERAR (CU39) ═══════════════════

  async generar(idUsuario: number, dto: GenerarReporteDto): Promise<ReporteResponseDto> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id_usuario: idUsuario },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${idUsuario} no encontrado.`);
    }

    // ── Formato: esta versión implementa JSON y CSV ──
    const formato = dto.formato ?? 'JSON';
    if (formato === 'PDF' || formato === 'XLSX') {
      throw new BadRequestException(
        `El formato ${formato} no está disponible en esta versión; ` +
          'usa JSON (datos en la respuesta) o CSV (archivo en R2).',
      );
    }

    // ── Alcance según rol ──
    let idInstitucion: number | null = null;
    if (usuario.rol === 'INSTITUCION') {
      idInstitucion = Number(usuario.id_institucion ?? 0) || null;
      if (idInstitucion === null) {
        throw new BadRequestException(
          'Tu usuario no tiene institución asignada; no puede generar ' +
            'reportes institucionales. Contacta al administrador.',
        );
      }
    } else if (dto.id_institucion) {
      idInstitucion = dto.id_institucion; // ADMIN puede apuntar a una institución
    }

    // ── Periodo ──
    if (dto.periodo_inicio && dto.periodo_fin && dto.periodo_fin < dto.periodo_inicio) {
      throw new BadRequestException(
        'periodo_fin no puede ser anterior a periodo_inicio.',
      );
    }
    const desde = dto.periodo_inicio ?? INICIO_HISTORICO;
    const hasta = dto.periodo_fin ?? FIN_HISTORICO;
    const conPeriodo = Boolean(dto.periodo_inicio || dto.periodo_fin);

    // ── Cálculo según tipo ──
    const { metricas, filas, resumen } = await this.calcular(
      dto.tipo_reporte,
      desde,
      hasta,
      idInstitucion,
    );

    // ── CSV → R2 (con BOM para que Excel lea acentos) ──
    let r2_key: string | null = null;
    if (formato === 'CSV') {
      if (filas.length === 0) {
        throw new BadRequestException(
          'El reporte no tiene filas para exportar a CSV en el periodo elegido; ' +
            'prueba con formato JSON o un periodo distinto.',
        );
      }
      const csv = this.armarCsv(filas);
      // Best-effort (misma convención que las evidencias): si R2 no
      // está disponible el reporte SE CONSERVA (datos JSON + r2_key
      // nulo) y /descargar explicará que no hay archivo. Nunca se
      // pierde la generación completa.
      try {
        const subido = await this.r2Service.subirArchivo(
          idUsuario,
          Buffer.from('\uFEFF' + csv, 'utf8'),
          'text/csv',
          'reportes',
        );
        r2_key = subido.r2_key;
      } catch (error) {
        this.logger.warn(
          `⚠️ CSV sin archivo (R2 no disponible); el reporte se conserva con los datos JSON: ${error}`,
        );
      }
    }

    const titulo =
      LABELS[dto.tipo_reporte] +
      ' — ' +
      (conPeriodo ? `${dto.periodo_inicio ?? 'inicio'} a ${dto.periodo_fin ?? 'hoy'}` : 'histórico');

    const reporte = await this.reportesRepo.save(
      this.reportesRepo.create({
        id_usuario_generador: idUsuario,
        id_institucion: idInstitucion,
        tipo_reporte: dto.tipo_reporte,
        periodo_inicio: dto.periodo_inicio ?? null,
        periodo_fin: dto.periodo_fin ?? null,
        titulo,
        resumen,
        datos: {
          periodo: { inicio: dto.periodo_inicio ?? null, fin: dto.periodo_fin ?? null },
          generado_en: new Date().toISOString(),
          metricas,
          filas,
        },
        r2_key,
        formato,
      }),
    );
    const idReporte = Number(reporte.id_reporte);

    await this.historialService.registrar(
      idUsuario,
      TIPOS_ACTIVIDAD.REPORTE_GENERADO,
      idReporte,
      `Generó '${titulo}'.`,
    );

    this.logger.log(
      `📊 Reporte ${idReporte} (${dto.tipo_reporte}, ${formato}) generado por usuario ${idUsuario}.`,
    );

    return this.armar(reporte, false);
  }

  // ═══════════════════ CONSULTAS ═══════════════════

  async listar(
    idUsuario: number,
    query: ReporteQueryDto,
  ): Promise<RespuestaPaginada<ReporteResponseDto>> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id_usuario: idUsuario },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${idUsuario} no encontrado.`);
    }

    const qb = this.reportesRepo
      .createQueryBuilder('reporte')
      .orderBy('reporte.fecha_generacion', 'DESC')
      .skip(query.skip)
      .take(query.take);

    if (usuario.rol !== 'ADMIN') {
      // INSTITUCION: lo de su institución o lo que ella generó
      const propia = Number(usuario.id_institucion ?? 0) || null;
      qb.andWhere(
        '(reporte.id_institucion = :propia OR reporte.id_usuario_generador = :idUsuario)',
        { propia, idUsuario },
      );
    } else if (query.id_institucion) {
      qb.andWhere('reporte.id_institucion = :idInstitucion', {
        idInstitucion: query.id_institucion,
      });
    }

    if (query.tipo_reporte) {
      qb.andWhere('reporte.tipo_reporte = :tipo', {
        tipo: query.tipo_reporte,
      });
    }

    const [reportes, total] = await qb.getManyAndCount();
    return construirRespuestaPaginada(
      reportes.map((r) => this.armar(r, false)),
      total,
      query,
    );
  }

  async obtenerPorId(idUsuario: number, idReporte: number): Promise<ReporteResponseDto> {
    const reporte = await this.reportesRepo.findOne({
      where: { id_reporte: idReporte },
    });
    if (!reporte) {
      throw new NotFoundException(`Reporte con id ${idReporte} no encontrado.`);
    }

    const usuario = await this.usuariosRepo.findOne({
      where: { id_usuario: idUsuario },
    });
    if (!usuario || !this.puedeVer(usuario, reporte)) {
      throw new ForbiddenException('No tienes acceso a este reporte.');
    }

    return this.armar(reporte, true);
  }

  async descargar(
    idUsuario: number,
    idReporte: number,
  ): Promise<DescargaReporteDto> {
    const reporte = await this.reportesRepo.findOne({
      where: { id_reporte: idReporte },
    });
    if (!reporte) {
      throw new NotFoundException(`Reporte con id ${idReporte} no encontrado.`);
    }

    const usuario = await this.usuariosRepo.findOne({
      where: { id_usuario: idUsuario },
    });
    if (!usuario || !this.puedeVer(usuario, reporte)) {
      throw new ForbiddenException('No tienes acceso a este reporte.');
    }

    if (!reporte.r2_key) {
      throw new BadRequestException(
        'Este reporte no tiene archivo adjunto (formato JSON); ' +
          'los datos están en GET /reportes/' + idReporte + '.',
      );
    }

    return {
      id_reporte: idReporte,
      formato: reporte.formato,
      r2_key: reporte.r2_key,
      url: this.r2Service.construirUrl(reporte.r2_key),
    };
  }

  async eliminar(idUsuario: number, idReporte: number): Promise<{ eliminado: boolean }> {
    const reporte = await this.reportesRepo.findOne({
      where: { id_reporte: idReporte },
    });
    if (!reporte) {
      throw new NotFoundException(`Reporte con id ${idReporte} no encontrado.`);
    }

    await this.reportesRepo.remove(reporte);

    // Limpieza del CSV best-effort (no bloquea la respuesta)
    if (reporte.r2_key) {
      await this.r2Service.eliminar(reporte.r2_key);
    }

    this.logger.log(
      `📊 Reporte ${idReporte} eliminado por usuario ${idUsuario}.`,
    );
    return { eliminado: true };
  }

  // ═══════════════════ CÁLCULO DE MÉTRICAS ═══════════════════

  /**
   * Métricas + filas por tipo de reporte.
   * $1 = desde, $2 = hasta, $3 = id_institucion (NULL = global).
   * MONITOREO_IA es un log del sistema: no se filtra por institución.
   */
  private async calcular(
    tipo: TipoReporte,
    desde: string,
    hasta: string,
    idInstitucion: number | null,
  ): Promise<{ metricas: Metricas; filas: Fila[]; resumen: string }> {
    const params = [desde, hasta, idInstitucion];
    const scopeU = '($3::bigint IS NULL OR u.id_institucion = $3::bigint)';

    switch (tipo) {
      case 'USO_APLICACION': {
        const usuariosTotal = await this.uno(
          `SELECT COUNT(*)::int AS total FROM usuarios u WHERE ${scopeU}`,
          [desde, hasta, idInstitucion],
        );
        const porRol = await this.varias(
          `SELECT u.rol, COUNT(*)::int AS usuarios FROM usuarios u
            WHERE ${scopeU} GROUP BY u.rol ORDER BY usuarios DESC`,
          [desde, hasta, idInstitucion],
        );
        const activos = await this.uno(
          `SELECT COUNT(*)::int AS total FROM usuarios u
            WHERE ${scopeU} AND u.ultimo_acceso::date BETWEEN $1::date AND $2::date`,
          [desde, hasta, idInstitucion],
        );
        const navegaciones = await this.uno(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE n.estado = 'COMPLETADA')::int AS completadas
             FROM navegaciones n
             JOIN usuarios u ON u.id_usuario = n.id_usuario
            WHERE ${scopeU} AND n.fecha_inicio::date BETWEEN $1::date AND $2::date`,
          [desde, hasta, idInstitucion],
        );
        const actividades = await this.uno(
          `SELECT COUNT(*)::int AS total
             FROM historial_actividades h
             JOIN usuarios u ON u.id_usuario = h.id_usuario
            WHERE ${scopeU} AND h.fecha_actividad::date BETWEEN $1::date AND $2::date`,
          [desde, hasta, idInstitucion],
        );

        const metricas: Metricas = {
          usuarios_total: usuariosTotal.total,
          usuarios_activos_en_periodo: activos.total,
          navegaciones_total: navegaciones.total,
          navegaciones_completadas: navegaciones.completadas,
          actividades_registradas: actividades.total,
          usuarios_por_rol: porRol,
        };
        return {
          metricas,
          filas: porRol,
          resumen:
            `${usuariosTotal.total} usuarios en el alcance ` +
            `(${activos.total} activos en el periodo); ` +
            `${navegaciones.total} navegaciones (${navegaciones.completadas} completadas).`,
        };
      }

      case 'PROGRESO_VISIONCOACH': {
        const sesiones = await this.uno(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE s.estado = 'COMPLETADA')::int AS completadas,
                  COUNT(*) FILTER (WHERE s.estado = 'ABANDONADA')::int AS abandonadas,
                  COALESCE(SUM(s.puntos_obtenidos), 0)::int AS puntos
             FROM sesiones_visioncoach s
             JOIN usuarios u ON u.id_usuario = s.id_usuario
            WHERE ${scopeU} AND s.fecha_inicio::date BETWEEN $1::date AND $2::date`,
          [desde, hasta, idInstitucion],
        );
        const progreso = await this.uno(
          `SELECT COUNT(*)::int AS usuarios,
                  COALESCE(ROUND(AVG(pv.puntos_totales)), 0) AS promedio_puntos,
                  COALESCE(ROUND(AVG(pv.nivel), 1), 0) AS promedio_nivel
             FROM progreso_visioncoach pv
             JOIN usuarios u ON u.id_usuario = pv.id_usuario
            WHERE ${scopeU}`,
          [desde, hasta, idInstitucion],
        );
        const filas = await this.varias(
          `SELECT u.id_usuario,
                  COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), u.correo) AS usuario,
                  pv.nivel, pv.puntos_totales, pv.mejor_racha, pv.ejercicios_completados
             FROM progreso_visioncoach pv
             JOIN usuarios u ON u.id_usuario = pv.id_usuario
             LEFT JOIN perfiles p ON p.id_usuario = u.id_usuario
            WHERE ${scopeU}
            ORDER BY pv.puntos_totales DESC, pv.nivel DESC
            LIMIT 20`,
          [desde, hasta, idInstitucion],
        );

        return {
          metricas: {
            sesiones_en_periodo: sesiones.total,
            sesiones_completadas: sesiones.completadas,
            sesiones_abandonadas: sesiones.abandonadas,
            puntos_otorgados: sesiones.puntos,
            usuarios_con_progreso: progreso.usuarios,
            promedio_puntos: progreso.promedio_puntos,
            promedio_nivel: progreso.promedio_nivel,
          },
          filas,
          resumen:
            `${sesiones.total} sesiones en el periodo (${sesiones.completadas} completadas, ` +
            `${sesiones.puntos} puntos otorgados); top 20 por puntos incluido.`,
        };
      }

      case 'INCIDENTES': {
        const totales = await this.uno(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE i.estado IN ('RESUELTO', 'CERRADO'))::int AS resueltos,
                  COUNT(*) FILTER (WHERE i.estado = 'ABIERTO')::int AS abiertos,
                  ROUND(AVG(EXTRACT(EPOCH FROM (i.fecha_cierre - i.fecha_incidente)) / 3600)::numeric, 1) AS promedio_horas_cierre
             FROM incidentes i
             JOIN usuarios u ON u.id_usuario = i.id_usuario
            WHERE ${scopeU} AND i.fecha_incidente::date BETWEEN $1::date AND $2::date`,
          [desde, hasta, idInstitucion],
        );
        const porEstado = await this.varias(
          `SELECT i.estado, COUNT(*)::int AS cantidad
             FROM incidentes i
             JOIN usuarios u ON u.id_usuario = i.id_usuario
            WHERE ${scopeU} AND i.fecha_incidente::date BETWEEN $1::date AND $2::date
            GROUP BY i.estado ORDER BY cantidad DESC`,
          [desde, hasta, idInstitucion],
        );
        const porSeveridad = await this.varias(
          `SELECT i.severidad, COUNT(*)::int AS cantidad
             FROM incidentes i
             JOIN usuarios u ON u.id_usuario = i.id_usuario
            WHERE ${scopeU} AND i.fecha_incidente::date BETWEEN $1::date AND $2::date
            GROUP BY i.severidad ORDER BY cantidad DESC`,
          [desde, hasta, idInstitucion],
        );

        return {
          metricas: {
            total: totales.total,
            resueltos: totales.resueltos,
            abiertos: totales.abiertos,
            promedio_horas_cierre: totales.promedio_horas_cierre,
            por_severidad: porSeveridad,
          },
          filas: porEstado,
          resumen:
            `${totales.total} incidentes en el periodo ` +
            `(${totales.resueltos} resueltos, ${totales.abiertos} abiertos).` +
            (totales.promedio_horas_cierre !== null
              ? ` Cierre promedio: ${totales.promedio_horas_cierre} horas.`
              : ''),
        };
      }

      case 'MONITOREO_IA': {
        // Log del sistema: alcance global (sin filtro de institución)
        const totales = await this.uno(
          `SELECT COUNT(*)::int AS total,
                  ROUND(AVG(r.duracion_ms)::numeric, 1) AS duracion_promedio_ms
             FROM registros_ia r
            WHERE r.fecha_ejecucion::date BETWEEN $1::date AND $2::date`,
          [desde, hasta],
        );
        const porEstado = await this.varias(
          `SELECT COALESCE(r.resultado_estado, '—') AS estado, COUNT(*)::int AS cantidad
             FROM registros_ia r
            WHERE r.fecha_ejecucion::date BETWEEN $1::date AND $2::date
            GROUP BY r.resultado_estado ORDER BY cantidad DESC`,
          [desde, hasta],
        );
        const porOperacion = await this.varias(
          `SELECT COALESCE(r.tipo_operacion, '—') AS operacion, COUNT(*)::int AS cantidad
             FROM registros_ia r
            WHERE r.fecha_ejecucion::date BETWEEN $1::date AND $2::date
            GROUP BY r.tipo_operacion ORDER BY cantidad DESC`,
          [desde, hasta],
        );
        const filas = await this.varias(
          `SELECT COALESCE(m.nombre, 'sin modelo') AS modelo,
                  COALESCE(m.version, '') AS version,
                  COUNT(*)::int AS registros,
                  ROUND(AVG(r.duracion_ms)::numeric, 1) AS duracion_promedio_ms,
                  ROUND(AVG(r.confianza)::numeric, 3) AS confianza_promedio
             FROM registros_ia r
             LEFT JOIN modelos_ia m ON m.id_modelo = r.id_modelo
            WHERE r.fecha_ejecucion::date BETWEEN $1::date AND $2::date
            GROUP BY m.nombre, m.version
            ORDER BY registros DESC LIMIT 20`,
          [desde, hasta],
        );

        return {
          metricas: {
            total: totales.total,
            duracion_promedio_ms: totales.duracion_promedio_ms,
            por_estado: porEstado,
            por_operacion: porOperacion,
          },
          filas,
          resumen:
            `${totales.total} ejecuciones de IA en el periodo ` +
            `(duración promedio ${totales.duracion_promedio_ms ?? '—'} ms).`,
        };
      }

      default:
        throw new BadRequestException(
          `tipo_reporte no soportado: ${tipo}. Valores: ${TIPOS_REPORTE.join(', ')}.`,
        );
    }
  }

  /** Primera fila de una consulta agregada (números ya normalizados) */
  private async uno(sql: string, params: unknown[]): Promise<Fila> {
    const filas = (await this.reportesRepo.query(sql, params)) as Fila[];
    return filas.length > 0 ? filas[0] : {};
  }

  /** Todas las filas de una consulta agregada */
  private async varias(sql: string, params: unknown[]): Promise<Fila[]> {
    return (await this.reportesRepo.query(sql, params)) as Fila[];
  }

  // ═══════════════════ HELPERS ═══════════════════

  /** ADMIN ve todo; INSTITUCION lo suyo o lo que ella generó */
  private puedeVer(
    usuario: Usuario,
    reporte: Reporte,
  ): boolean {
    if (usuario.rol === 'ADMIN') return true;
    const propia = Number(usuario.id_institucion ?? 0) || null;
    return (
      (propia !== null && Number(reporte.id_institucion) === propia) ||
      Number(reporte.id_usuario_generador) === Number(usuario.id_usuario)
    );
  }

  /** CSV RFC 4180 simplificado (coma, comillas y saltos escapados) */
  private armarCsv(filas: Fila[]): string {
    const columnas: string[] = [];
    for (const fila of filas) {
      for (const key of Object.keys(fila)) {
        if (!columnas.includes(key)) columnas.push(key);
      }
    }

    const escapar = (valor: unknown): string => {
      const texto =
        valor === null || valor === undefined ? '' : String(valor);
      return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };

    const lineas = [columnas.map(escapar).join(',')];
    for (const fila of filas) {
      lineas.push(columnas.map((c) => escapar(fila[c])).join(','));
    }
    return lineas.join('\r\n');
  }

  /** Entidad → DTO (datos y URL solo en detalle/descarga) */
  private armar(reporte: Reporte, conDatos: boolean): ReporteResponseDto {
    return {
      id_reporte: Number(reporte.id_reporte),
      id_usuario_generador:
        reporte.id_usuario_generador !== null
          ? Number(reporte.id_usuario_generador)
          : null,
      id_institucion:
        reporte.id_institucion !== null
          ? Number(reporte.id_institucion)
          : null,
      tipo_reporte: reporte.tipo_reporte,
      periodo_inicio: reporte.periodo_inicio,
      periodo_fin: reporte.periodo_fin,
      titulo: reporte.titulo,
      resumen: reporte.resumen,
      formato: reporte.formato,
      fecha_generacion: reporte.fecha_generacion,
      ...(conDatos ? { datos: reporte.datos } : {}),
      url_descarga: reporte.r2_key
        ? this.r2Service.construirUrl(reporte.r2_key)
        : null,
    };
  }
}
