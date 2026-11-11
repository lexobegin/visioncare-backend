import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import {
  construirRespuestaPaginada,
  PaginationDto,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Alerta } from './entities/alerta.entity';
import {
  AlertaQueryDto,
  AlertaResponseDto,
  AtenderLoteDto,
  ResumenAlertasDto,
} from './dto';

/**
 * ══════════════════════════════════════════════════════
 * Servicio de alertas (HU17/HU18 + vista web).
 *
 *   listarPendientes() → el móvil las reproduce y atiende
 *   atenderLote()      → marca N reproducidas (bulk)
 *   atender()          → marca una (puntual)
 *   listar()/listarPorUsuario() → historial con filtros
 *   resumen()          → dashboard (niveles, tipos, hoy)
 *
 * Reglas de propiedad: pendientes/atender/historial usan el
 * id del JWT; ver de otro usuario → solo ADMIN/INSTITUCION
 * (validado en el controller con @Roles).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class AlertasService {
  constructor(
    @InjectRepository(Alerta)
    private readonly alertasRepo: Repository<Alerta>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {}

  // ═══════════════ PENDIENTES (móvil, HU18) ═══════════════

  /**
   * Alertas sin atender, PRIORIDAD DESC (CRITICO primero —
   * HU17: comunicar primero lo de mayor riesgo) y dentro de
   * la misma prioridad, la más reciente primero.
   */
  async listarPendientes(
    idUsuario: number,
    paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<AlertaResponseDto>> {
    const qb = this.alertasRepo
      .createQueryBuilder('alerta')
      .where('alerta.id_usuario = :idUsuario', { idUsuario })
      .andWhere('alerta.atendida = FALSE')
      .orderBy('alerta.prioridad', 'DESC')
      .addOrderBy('alerta.fecha_generacion', 'DESC')
      .skip(paginacion.skip)
      .take(paginacion.take);

    const [alertas, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      alertas.map((a) => this.mapearARespuesta(a)),
      total,
      paginacion,
    );
  }

  // ═══════════════ ATENDER ═══════════════

  /** Marca una alerta como atendida (verifica propiedad → 404 si ajena) */
  async atender(
    idAlerta: number,
    idUsuario: number,
  ): Promise<{ mensaje: string }> {
    const resultado = await this.alertasRepo.update(
      { id_alerta: idAlerta, id_usuario: idUsuario },
      { atendida: true, fecha_atencion: new Date() },
    );

    if (resultado.affected === 0) {
      throw new NotFoundException(
        `Alerta con id ${idAlerta} no encontrada.`,
      );
    }

    return { mensaje: `Alerta ${idAlerta} marcada como atendida.` };
  }

  /**
   * Marca N alertas como atendidas EN UNA consulta (bulk).
   * Solo cuenta las que eran del usuario — silenciosamente
   * ignora ids ajenos (el móvil no necesita distinguir).
   */
  async atenderLote(
    dto: AtenderLoteDto,
    idUsuario: number,
  ): Promise<{ atendidas: number }> {
    const idsUnicos = [...new Set(dto.ids)];

    const resultado = await this.alertasRepo
      .createQueryBuilder()
      .update(Alerta)
      .set({ atendida: true, fecha_atencion: new Date() })
      .where('id_usuario = :idUsuario', { idUsuario })
      .andWhere('id_alerta IN (:...ids)', { ids: idsUnicos })
      .andWhere('atendida = FALSE')
      .execute();

    return { atendidas: resultado.affected ?? 0 };
  }

  // ═══════════════ HISTORIAL ═══════════════

  /** Historial propio con filtros (nivel, tipo, atendida) */
  async listar(
    idUsuario: number,
    query: AlertaQueryDto,
  ): Promise<RespuestaPaginada<AlertaResponseDto>> {
    const qb = this.baseHistorial(idUsuario, query)
      .orderBy('alerta.fecha_generacion', 'DESC')
      .skip(query.skip)
      .take(query.take);

    const [alertas, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      alertas.map((a) => this.mapearARespuesta(a)),
      total,
      query,
    );
  }

  /** CU37/CU38 web — historial de otro usuario (controller valida roles) */
  async listarPorUsuario(
    idUsuarioObjetivo: number,
    query: AlertaQueryDto,
  ): Promise<RespuestaPaginada<AlertaResponseDto>> {
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

  // ═══════════════ RESUMEN (dashboard) ═══════════════

  async resumen(idUsuario: number): Promise<ResumenAlertasDto> {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const base = this.alertasRepo
      .createQueryBuilder('alerta')
      .where('alerta.id_usuario = :idUsuario', { idUsuario });

    // ─── Por nivel ───
    const porNivelFilas = await base
      .clone()
      .select('alerta.nivel', 'nivel')
      .addSelect('COUNT(*)', 'total')
      .groupBy('alerta.nivel')
      .getRawMany<{ nivel: string; total: string }>();

    const por_nivel: Record<string, number> = {
      BAJO: 0,
      MEDIO: 0,
      ALTO: 0,
      CRITICO: 0,
    };
    for (const f of porNivelFilas) {
      por_nivel[f.nivel] = Number(f.total);
    }

    // ─── Por tipo ───
    const porTipoFilas = await base
      .clone()
      .select('alerta.tipo_alerta', 'tipo_alerta')
      .addSelect('COUNT(*)', 'total')
      .groupBy('alerta.tipo_alerta')
      .orderBy('total', 'DESC')
      .getRawMany<{ tipo_alerta: string; total: string }>();

    // ─── Pendientes / hoy ───
    const [pendientes, hoy] = await Promise.all([
      base.clone().andWhere('alerta.atendida = FALSE').getCount(),
      base
        .clone()
        .andWhere('alerta.fecha_generacion >= :inicioHoy', { inicioHoy })
        .getCount(),
    ]);

    return {
      por_nivel,
      por_tipo: porTipoFilas.map((f) => ({
        tipo_alerta: f.tipo_alerta,
        total: Number(f.total),
      })),
      total_pendientes: pendientes,
      total_hoy: hoy,
    };
  }

  // ═══════════════════ HELPERS ═══════════════════

  /** Query base compartida del historial (filtros reutilizables) */
  private baseHistorial(idUsuario: number, query: AlertaQueryDto) {
    const qb = this.alertasRepo
      .createQueryBuilder('alerta')
      .where('alerta.id_usuario = :idUsuario', { idUsuario });

    if (query.nivel) {
      qb.andWhere('alerta.nivel = :nivel', { nivel: query.nivel });
    }

    if (query.tipo_alerta) {
      qb.andWhere('alerta.tipo_alerta = :tipo', {
        tipo: query.tipo_alerta.toUpperCase(),
      });
    }

    if (query.atendida !== undefined) {
      const atendidaBool = query.atendida === 'true';
      qb.andWhere('alerta.atendida = :atendida', {
        atendida: atendidaBool,
      });
    }

    // Búsqueda libre sobre el mensaje
    if (query.buscar) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('alerta.mensaje ILIKE :buscar').orWhere(
            'alerta.tipo_alerta ILIKE :buscar',
          );
        }),
      ).setParameter('buscar', `%${query.buscar}%`);
    }

    return qb;
  }

  private mapearARespuesta(a: Alerta): AlertaResponseDto {
    return {
      id_alerta: Number(a.id_alerta),
      id_usuario: Number(a.id_usuario),
      id_deteccion: a.id_deteccion !== null ? Number(a.id_deteccion) : null,
      tipo_alerta: a.tipo_alerta,
      nivel: a.nivel,
      mensaje: a.mensaje,
      prioridad: a.prioridad,
      canal: a.canal,
      atendida: a.atendida,
      fecha_generacion: a.fecha_generacion,
      fecha_atencion: a.fecha_atencion,
    };
  }
}