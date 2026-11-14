import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import {
  construirRespuestaPaginada,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { ModeloIa } from './entities/modelo-ia.entity';
import { RegistroIa } from './entities/registro-ia.entity';
import {
  ConsultarRegistrosDto,
  RegistroResponseDto,
} from './dto';

/**
 * ══════════════════════════════════════════════════════
 * Servicio de monitoreo IA (CU40).
 *
 * Estrategia: lectura DIRECTA de `modelos_ia` / `registros_ia`
 * (el mismo PostgreSQL que comparte con FastAPI). Evita sumar
 * una llamada HTTP al servicio IA para consultar histórico y
 * sigue funcionando aunque FastAPI esté reiniciando.
 *
 *   listarModelos(): catálogo (opcional filtro por estado).
 *   listarRegistros(): ejecuciones paginadas con filtros.
 *   resumen(): agregados para el dashboard web (CU40).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class MonitoreoService {
  private readonly logger = new Logger(MonitoreoService.name);

  constructor(
    @InjectRepository(ModeloIa)
    private readonly modelosRepo: Repository<ModeloIa>,
    @InjectRepository(RegistroIa)
    private readonly registrosRepo: Repository<RegistroIa>,
  ) {}

  // ═══════════════════ MODELOS ═══════════════════

  /** Catálogo de modelos desplegados en FastAPI. */
  async listarModelos(estado?: string): Promise<ModeloIa[]> {
    const qb = this.modelosRepo
      .createQueryBuilder('modelo')
      .orderBy('modelo.nombre', 'ASC');

    if (estado) {
      qb.andWhere('modelo.estado = :estado', { estado });
    }

    return qb.getMany();
  }

  // ═══════════════════ REGISTROS ═══════════════════

  /** Ejecuciones IA paginadas y filtradas. */
  async listarRegistros(
    query: ConsultarRegistrosDto,
  ): Promise<RespuestaPaginada<RegistroResponseDto>> {
    const [registros, total] = await this.armarFiltros(query)
      .leftJoinAndSelect('registros.modelo', 'modelo')
      .orderBy('registros.fecha_ejecucion', 'DESC')
      .skip(query.skip)
      .take(query.take)
      .getManyAndCount();

    return construirRespuestaPaginada(
      registros.map((r) => this.mapearRegistro(r)),
      total,
      query,
    );
  }

  // ═══════════════════ RESUMEN (dashboard) ═══════════════════

  /**
   * Agregados del periodo: totales, tasa de éxito, duración
   * promedio por operación, top modelos y últimos errores.
   */
  async resumen(fechaDesde?: string, fechaHasta?: string) {
    const desde = fechaDesde ? new Date(fechaDesde) : undefined;
    const hasta = fechaHasta ? new Date(fechaHasta) : undefined;
    if (hasta) hasta.setHours(23, 59, 59, 999);

    // QueryBuilder fresco por consulta (los filtros se reutilizan)
    const conPeriodo = (): SelectQueryBuilder<RegistroIa> => {
      const qb = this.registrosRepo.createQueryBuilder('registros');
      if (desde) {
        qb.andWhere('registros.fecha_ejecucion >= :desde', { desde });
      }
      if (hasta) {
        qb.andWhere('registros.fecha_ejecucion <= :hasta', { hasta });
      }
      return qb;
    };

    const total = await conPeriodo().getCount();

    const porEstado = await conPeriodo()
      .select('registros.resultado_estado', 'estado')
      .addSelect('COUNT(*)::int', 'total')
      .groupBy('registros.resultado_estado')
      .getRawMany<{ estado: string; total: number }>();

    const porOperacion = await conPeriodo()
      .select('registros.tipo_operacion', 'operacion')
      .addSelect('COUNT(*)::int', 'total')
      .addSelect('ROUND(AVG(registros.duracion_ms))::int', 'duracion_promedio_ms')
      .groupBy('registros.tipo_operacion')
      .orderBy('"total"', 'DESC')
      .getRawMany<{
        operacion: string;
        total: number;
        duracion_promedio_ms: number;
      }>();

    const porModelo = await conPeriodo()
      .leftJoin(ModeloIa, 'modelo', 'modelo.id_modelo = registros.id_modelo')
      .select('modelo.nombre', 'modelo')
      .addSelect('COUNT(*)::int', 'total')
      .groupBy('modelo.nombre')
      .orderBy('"total"', 'DESC')
      .limit(10)
      .getRawMany<{ modelo: string | null; total: number }>();

    const ultimosErrores = await conPeriodo()
      .andWhere('registros.resultado_estado = :estado', { estado: 'ERROR' })
      .orderBy('registros.fecha_ejecucion', 'DESC')
      .take(5)
      .getMany();

    const exitos = porEstado.find((e) => e.estado === 'EXITO')?.total ?? 0;
    const errores = porEstado.find((e) => e.estado === 'ERROR')?.total ?? 0;
    const tasaExito = total > 0 ? Math.round((exitos / total) * 1000) / 10 : null;

    this.logger.log(
      `Resumen IA: ${total} ejecuciones, tasa de éxito ${tasaExito ?? 'N/A'}%.`,
    );

    return {
      periodo: {
        fecha_desde: desde ?? null,
        fecha_hasta: hasta ?? null,
      },
      total,
      exitos,
      errores,
      tasa_exito: tasaExito,
      por_estado: porEstado,
      por_operacion: porOperacion,
      por_modelo: porModelo,
      ultimos_errores: ultimosErrores.map((r) => ({
        id_registro: Number(r.id_registro),
        tipo_operacion: r.tipo_operacion,
        mensaje_error: r.mensaje_error,
        fecha_ejecucion: r.fecha_ejecucion,
      })),
    };
  }

  // ═══════════════════ HELPERS ═══════════════════

  /** Aplica los filtros del DTO a un QueryBuilder nuevo. */
  private armarFiltros(query: ConsultarRegistrosDto): SelectQueryBuilder<RegistroIa> {
    const qb = this.registrosRepo.createQueryBuilder('registros');

    if (query.id_usuario) {
      qb.andWhere('registros.id_usuario = :idUsuario', {
        idUsuario: query.id_usuario,
      });
    }
    if (query.tipo_operacion) {
      qb.andWhere('registros.tipo_operacion = :tipoOperacion', {
        tipoOperacion: query.tipo_operacion,
      });
    }
    if (query.resultado_estado) {
      qb.andWhere('registros.resultado_estado = :resultadoEstado', {
        resultadoEstado: query.resultado_estado,
      });
    }
    if (query.fecha_desde) {
      const desde = new Date(query.fecha_desde);
      qb.andWhere('registros.fecha_ejecucion >= :desde', { desde });
    }
    if (query.fecha_hasta) {
      const hasta = new Date(query.fecha_hasta);
      hasta.setHours(23, 59, 59, 999);
      qb.andWhere('registros.fecha_ejecucion <= :hasta', { hasta });
    }
    if (query.buscar) {
      qb.andWhere('registros.tipo_operacion ILIKE :buscar', {
        buscar: `%${query.buscar}%`,
      });
    }

    return qb;
  }

  /** Entidad → DTO (modelo resumido para la grilla web). */
  private mapearRegistro(registro: RegistroIa): RegistroResponseDto {
    return {
      id_registro: Number(registro.id_registro),
      id_modelo:
        registro.id_modelo !== null ? Number(registro.id_modelo) : null,
      id_usuario:
        registro.id_usuario !== null ? Number(registro.id_usuario) : null,
      id_captura:
        registro.id_captura !== null ? Number(registro.id_captura) : null,
      tipo_operacion: registro.tipo_operacion,
      duracion_ms: registro.duracion_ms,
      resultado_estado: registro.resultado_estado,
      confianza: registro.confianza !== null ? Number(registro.confianza) : null,
      mensaje_error: registro.mensaje_error,
      metadatos: registro.metadatos,
      fecha_ejecucion: registro.fecha_ejecucion,
      modelo: registro.modelo
        ? {
            nombre: registro.modelo.nombre,
            version: registro.modelo.version,
            tipo_modelo: registro.modelo.tipo_modelo,
          }
        : null,
    };
  }
}
