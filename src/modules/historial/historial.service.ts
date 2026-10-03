import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  construirRespuestaPaginada,
  PaginationDto,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  HistorialActividad,
  TIPOS_ACTIVIDAD,
} from './entities/historial-actividad.entity';
import {
  ActividadResponseDto,
  HistorialQueryDto,
  ResumenActividadDto,
} from './dto';

/** Tipos "virtuales" que provienen de otras tablas (consolidado) */
export const TIPO_COMANDO_VOZ = 'COMANDO_VOZ';
export const TIPO_CAPTURA_ENTORNO = 'CAPTURA_ENTORNO';

/**
 * ══════════════════════════════════════════════════════
 * Servicio de historial de actividades (CU37, base CU23).
 *
 *   registrar():  evento puntual (best-effort: nunca rompe el
 *                 flujo del módulo que lo invoca).
 *   listar():     feed paginado; modo consolidado usa SQL
 *                 UNION ALL de 3 fuentes (eficiente en BD,
 *                 paginación real — no en memoria).
 *   resumen():    conteos por tipo (dashboard web).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class HistorialService {
  private readonly logger = new Logger(HistorialService.name);

  constructor(
    @InjectRepository(HistorialActividad)
    private readonly historialRepo: Repository<HistorialActividad>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════════════ REGISTRAR ═══════════════════

  /**
   * Registra un evento. Best-effort: si falla (p. ej. tabla
   * no migrada aún), solo loguea — el flujo principal del
   * módulo llamador NUNCA se interrumpe por el historial.
   */
  async registrar(
    idUsuario: number,
    tipoActividad: string,
    referenciaId?: number,
    descripcion?: string,
  ): Promise<void> {
    try {
      await this.historialRepo.insert({
        id_usuario: idUsuario,
        tipo_actividad: tipoActividad,
        referencia_id: referenciaId ?? null,
        descripcion: descripcion ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar actividad '${tipoActividad}' del ` +
          `usuario ${idUsuario}: ${error}`,
      );
    }
  }

  // ═══════════════════ LISTAR ═══════════════════

  async listar(
    idUsuario: number,
    query: HistorialQueryDto,
  ): Promise<RespuestaPaginada<ActividadResponseDto>> {
    // consolidado !== false → default true
    if (query.consolidado !== false) {
      return this.listarConsolidado(idUsuario, query);
    }
    return this.listarSoloEventos(idUsuario, query);
  }

  /** Modo A: solo la tabla historial_actividades */
  private async listarSoloEventos(
    idUsuario: number,
    query: HistorialQueryDto,
  ): Promise<RespuestaPaginada<ActividadResponseDto>> {
    const qb = this.historialRepo
      .createQueryBuilder('h')
      .where('h.id_usuario = :idUsuario', { idUsuario })
      .orderBy('h.fecha_actividad', 'DESC')
      .skip(query.skip)
      .take(query.take);

    if (query.tipo_actividad) {
      qb.andWhere('h.tipo_actividad = :tipo', { tipo: query.tipo_actividad });
    }
    if (query.fecha_desde) {
      qb.andWhere('h.fecha_actividad >= :desde', { desde: query.fecha_desde });
    }
    if (query.fecha_hasta) {
      qb.andWhere('h.fecha_actividad <= :hasta', { hasta: query.fecha_hasta });
    }
    if (query.buscar) {
      qb.andWhere('h.descripcion ILIKE :buscar', {
        buscar: `%${query.buscar}%`,
      });
    }

    const [eventos, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      eventos.map((e) => this.mapearEvento(e)),
      total,
      query,
    );
  }

  /**
   * Modo B (consolidado): UNION ALL de eventos + comandos de
   * voz + capturas. SQL crudo parametrizado (seguro: ningún
   * valor del usuario se concatena, todo va por placeholders).
   */
  private async listarConsolidado(
    idUsuario: number,
    query: HistorialQueryDto,
  ): Promise<RespuestaPaginada<ActividadResponseDto>> {
    const { sqlUnion, params } = this.construirSqlConsolidado(query, idUsuario);

    // 1) Total con la misma unión (sin LIMIT/OFFSET)
    const totalSql = `SELECT COUNT(*)::int AS total FROM (${sqlUnion}) consolidado`;
    const totalRes = await this.dataSource.query(totalSql, [...params]);
    const total = Number(totalRes[0]?.total ?? 0);

    // 2) Página solicitada
    const paginaSql =
      `SELECT * FROM (${sqlUnion}) consolidado ` +
      `ORDER BY fecha DESC ` +
      `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    /*const filas = await this.dataSource.query(paginaSql, [
      ...params,
      query.take,
      query.skip,
    ]);*/
    const filas: Record<string, unknown>[] = await this.dataSource.query(
      paginaSql,
      [...params, query.take, query.skip],
    );

    return construirRespuestaPaginada(
      filas.map((f) => this.mapearFilaConsolidada(f)),
      total,
      query,
    );
  }

  /**
   * Construye el UNION ALL y sus parámetros posicionales.
   * - El filtro tipo_actividad decide qué fuentes entran
   *   (COMANDO_VOZ → solo voz; CAPTURA_ENTORNO → solo capturas;
   *   otro tipo → solo eventos).
   * - buscar filtra contra la descripción generada de cada fuente.
   */
  private construirSqlConsolidado(
    query: HistorialQueryDto,
    idUsuario: number,
  ): { sqlUnion: string; params: unknown[] } {
    const params: unknown[] = [idUsuario];
    let indice = 1;
    const next = (valor: unknown): string => {
      params.push(valor);
      return `$${++indice}`;
    };

    const tipo = query.tipo_actividad?.trim();
    const patronBusqueda = query.buscar ? `%${query.buscar}%` : null;

    // Filtro de fechas reutilizable por fuente
    const filtroFechas = (columna: string): string => {
      let fragmento = '';
      if (query.fecha_desde) {
        fragmento += ` AND ${columna} >= ${next(query.fecha_desde)}`;
      }
      if (query.fecha_hasta) {
        fragmento += ` AND ${columna} <= ${next(query.fecha_hasta)}`;
      }
      return fragmento;
    };

    const bloques: string[] = [];

    // ─── Bloque EVENTOS (tabla historial_actividades) ───
    // Entra siempre (si el tipo pedido no es VOZ/CAPTURA) o sin filtro
    if (!tipo || (tipo !== TIPO_COMANDO_VOZ && tipo !== TIPO_CAPTURA_ENTORNO)) {
      bloques.push(
        `SELECT 'EVENTO' AS fuente, ha.tipo_actividad, ha.descripcion, ` +
          `ha.referencia_id, ha.fecha_actividad AS fecha, ha.id_historial AS id_origen ` +
          `FROM historial_actividades ha ` +
          `WHERE ha.id_usuario = $1` +
          (tipo ? ` AND ha.tipo_actividad = ${next(tipo)}` : '') +
          (patronBusqueda
            ? ` AND ha.descripcion ILIKE ${next(patronBusqueda)}`
            : '') +
          filtroFechas('ha.fecha_actividad'),
      );
    }

    // ─── Bloque VOZ (tabla comandos_voz) ───
    if (!tipo || tipo === TIPO_COMANDO_VOZ) {
      bloques.push(
        `SELECT 'VOZ' AS fuente, '${TIPO_COMANDO_VOZ}' AS tipo_actividad, ` +
          `('Comando de voz: ' || cv.comando) AS descripcion, ` +
          `cv.id_comando AS referencia_id, cv.fecha_ejecucion AS fecha, ` +
          `cv.id_comando AS id_origen ` +
          `FROM comandos_voz cv ` +
          `WHERE cv.id_usuario = $1` +
          (patronBusqueda
            ? ` AND ('Comando de voz: ' || cv.comando) ILIKE ${next(patronBusqueda)}`
            : '') +
          filtroFechas('cv.fecha_ejecucion'),
      );
    }

    // ─── Bloque CAPTURAS (tabla capturas_entorno) ───
    if (!tipo || tipo === TIPO_CAPTURA_ENTORNO) {
      bloques.push(
        `SELECT 'CAPTURA' AS fuente, '${TIPO_CAPTURA_ENTORNO}' AS tipo_actividad, ` +
          `('Captura de entorno (' || ce.estado || ')') AS descripcion, ` +
          `ce.id_captura AS referencia_id, ce.fecha_captura AS fecha, ` +
          `ce.id_captura AS id_origen ` +
          `FROM capturas_entorno ce ` +
          `WHERE ce.id_usuario = $1` +
          (patronBusqueda
            ? ` AND ('Captura de entorno (' || ce.estado || ')') ILIKE ${next(patronBusqueda)}`
            : '') +
          filtroFechas('ce.fecha_captura'),
      );
    }

    return { sqlUnion: bloques.join(' UNION ALL '), params };
  }

  // ═══════════════════ RESUMEN ═══════════════════

  /** Conteos por tipo y fuente (dashboard web CU39/CU40) */
  async resumen(idUsuario: number): Promise<ResumenActividadDto[]> {
    const { sqlUnion, params } = this.construirSqlConsolidado(
      {} as HistorialQueryDto,
      idUsuario,
    );

    const sql =
      `SELECT c.tipo_actividad, c.fuente, COUNT(*)::int AS total ` +
      `FROM (${sqlUnion}) c ` +
      `GROUP BY c.tipo_actividad, c.fuente ` +
      `ORDER BY total DESC`;

    /*const filas = await this.dataSource.query(sql, [...params]);*/
    const filas: Record<string, unknown>[] = await this.dataSource.query(
      sql,
      [...params],
    );

    return filas.map((f) => ({
      tipo_actividad: String(f.tipo_actividad),
      fuente: String(f.fuente),
      total: Number(f.total),
    }));
  }

  // ═══════════════════ ADMIN (CU37 web) ═══════════════════

  /** Historial de un usuario específico (llamado con roles) */
  async listarPorUsuario(
    idUsuarioObjetivo: number,
    query: HistorialQueryDto,
  ): Promise<RespuestaPaginada<ActividadResponseDto>> {
    const existe = await this.usuariosRepo.exist({
      where: { id_usuario: idUsuarioObjetivo },
    });
    if (!existe) {
      throw new NotFoundException(
        `Usuario con id ${idUsuarioObjetivo} no encontrado.`,
      );
    }

    return this.listar(idUsuarioObjetivo, query);
  }

  // ═══════════════════ HELPERS ═══════════════════

  private mapearEvento(e: HistorialActividad): ActividadResponseDto {
    return {
      id: `evento-${Number(e.id_historial)}`,
      fuente: 'EVENTO',
      tipo_actividad: e.tipo_actividad,
      descripcion: e.descripcion,
      referencia_id: e.referencia_id !== null ? Number(e.referencia_id) : null,
      fecha: e.fecha_actividad,
    };
  }

  /** Fila cruda del UNION → DTO (pg devuelve bigint como string) */
  private mapearFilaConsolidada(f: Record<string, unknown>): ActividadResponseDto {
    const fuente = String(f.fuente) as ActividadResponseDto['fuente'];
    const idOrigen = Number(f.id_origen);

    return {
      id: `${fuente.toLowerCase()}-${idOrigen}`,
      fuente,
      tipo_actividad: String(f.tipo_actividad),
      descripcion: f.descripcion !== null ? String(f.descripcion) : null,
      referencia_id:
        f.referencia_id !== null && f.referencia_id !== undefined
          ? Number(f.referencia_id)
          : null,
      fecha: new Date(f.fecha as string),
    };
  }
}

// Re-export para conveniencia de los módulos consumidores
export { TIPOS_ACTIVIDAD };