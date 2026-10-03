import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  construirRespuestaPaginada,
  PaginationDto,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { ComandoVoz } from './entities/comando-voz.entity';
import {
  InterpretarComandoDto,
  ComandoHistorialDto,
  ComandoVozResponseDto,
} from './dto';
import {
  INTENCIONES_VOZ,
  INTENCION_DESCONOCIDA,
  IntencionVoz,
  normalizarTexto,
} from './voz.intenciones';

/** Resultado interno de la detección de intención */
interface DeteccionIntencion {
  codigo: string;
  casoUso: string | null;
  accionApp: string;
  respuestaVoz: string;
  /** Patrones que coincidieron (informativo) */
  coincidencias: number;
}

/**
 * ══════════════════════════════════════════════════════
 * Servicio de comandos de voz (CU06).
 *
 *   interpretar(): normaliza el texto → detecta intención →
 *                  registra SIEMPRE en comandos_voz →
 *                  devuelve acción + respuesta para TTS.
 *
 *   listarHistorial(): comandos del usuario, paginados y
 *                  filtrables por intención (base CU23).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class VozService {
  private readonly logger = new Logger(VozService.name);

  constructor(
    @InjectRepository(ComandoVoz)
    private readonly comandosRepo: Repository<ComandoVoz>,
  ) {}

  // ═══════════════════════ INTERPRETAR ═══════════════════════

  async interpretar(
    idUsuario: number,
    dto: InterpretarComandoDto,
  ): Promise<ComandoVozResponseDto> {
    const textoNormalizado = normalizarTexto(dto.comando);
    const deteccion = this.detectarIntencion(textoNormalizado);

    // Confianza combinada: intención × STT (si se envió)
    const confianza =
      dto.confianza_stt !== undefined
        ? Number((deteccion.coincidencias > 0
            ? this.confianzaBase(deteccion.coincidencias) * dto.confianza_stt
            : 0
          ).toFixed(4))
        : Number(
            (deteccion.coincidencias > 0
              ? this.confianzaBase(deteccion.coincidencias)
              : 0
            ).toFixed(4),
          );

    // Registrar SIEMPRE (también los desconocidos → análisis de mejoras)
    const registro = await this.comandosRepo.save(
      this.comandosRepo.create({
        id_usuario: idUsuario,
        comando: dto.comando.trim(),
        intencion: deteccion.codigo,
        resultado: deteccion.respuestaVoz,
        confianza,
      }),
    );

    if (deteccion.codigo === 'DESCONOCIDA') {
      this.logger.warn(
        `Comando no reconocido (usuario ${idUsuario}): "${dto.comando}"`,
      );
    }

    return {
      id_comando: Number(registro.id_comando),
      comando: registro.comando,
      intencion: deteccion.codigo,
      caso_uso: deteccion.casoUso,
      accion_app: deteccion.accionApp,
      respuesta_voz: deteccion.respuestaVoz,
      confianza,
      fecha_ejecucion: registro.fecha_ejecucion,
    };
  }

  /**
   * Detector de intención: gana la intención con MÁS patrones
   * coincidentes; en empate, la de mayor prioridad en el
   * catálogo (emergencias primero).
   */
  private detectarIntencion(textoNormalizado: string): DeteccionIntencion {
    let mejor: { intencion: IntencionVoz; coincidencias: number } | null = null;

    for (const intencion of INTENCIONES_VOZ) {
      const coincidencias = intencion.patrones.filter((p) =>
        p.test(textoNormalizado),
      ).length;

      if (coincidencias > 0 && (!mejor || coincidencias > mejor.coincidencias)) {
        mejor = { intencion, coincidencias };
      }
    }

    if (!mejor) {
      return {
        codigo: INTENCION_DESCONOCIDA.codigo,
        casoUso: INTENCION_DESCONOCIDA.casoUso,
        accionApp: INTENCION_DESCONOCIDA.accionApp,
        respuestaVoz: INTENCION_DESCONOCIDA.respuestaVoz,
        coincidencias: 0,
      };
    }

    return {
      codigo: mejor.intencion.codigo,
      casoUso: mejor.intencion.casoUso,
      accionApp: mejor.intencion.accionApp,
      respuestaVoz: mejor.intencion.respuestaVoz,
      coincidencias: mejor.coincidencias,
    };
  }

  /** 1 coincidencia → 0.6 | 2 → 0.8 | 3+ → 1.0 */
  private confianzaBase(coincidencias: number): number {
    return Math.min(1, 0.6 + (coincidencias - 1) * 0.2);
  }

  // ═══════════════════════ CONSULTAS ═══════════════════════

  /** Historial de mis comandos (paginado, filtrable por intención) */
  async listarHistorial(
    idUsuario: number,
    paginacion: PaginationDto & { intencion?: string },
  ): Promise<RespuestaPaginada<ComandoHistorialDto>> {
    const qb = this.comandosRepo
      .createQueryBuilder('comando')
      .where('comando.id_usuario = :idUsuario', { idUsuario })
      .orderBy('comando.fecha_ejecucion', 'DESC')
      .skip(paginacion.skip)
      .take(paginacion.take);

    if (paginacion.intencion) {
      qb.andWhere('comando.intencion = :intencion', {
        intencion: paginacion.intencion,
      });
    }

    if (paginacion.buscar) {
      qb.andWhere('comando.comando ILIKE :buscar', {
        buscar: `%${paginacion.buscar}%`,
      });
    }

    const [comandos, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      comandos.map((c) => this.mapearAHistorial(c)),
      total,
      paginacion,
    );
  }

  // ═══════════════════════ HELPERS ═══════════════════════

  private mapearAHistorial(comando: ComandoVoz): ComandoHistorialDto {
    return {
      id_comando: Number(comando.id_comando),
      comando: comando.comando,
      intencion: comando.intencion,
      resultado: comando.resultado,
      confianza: comando.confianza !== null ? Number(comando.confianza) : null,
      fecha_ejecucion: comando.fecha_ejecucion,
    };
  }
}