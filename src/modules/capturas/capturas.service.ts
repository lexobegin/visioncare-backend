import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  construirRespuestaPaginada,
  PaginationDto,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { R2Service } from '../archivos/r2.service';
import {
  CapturaEntorno,
  EstadoCaptura,
} from './entities/captura-entorno.entity';
import { DeteccionIA } from './entities/deteccion-ia.entity';
import {
  CapturaResponseDto,
  DeteccionResponseDto,
  RegistrarCapturaDto,
} from './dto';
import {
  VisionIaClient,
  RespuestaDeteccionIA,
} from './vision-ia.client';

/** MimeType por defecto cuando R2 no está configurado */
const MIME_DEFAULT = 'image/jpeg';

/**
 * ══════════════════════════════════════════════════════
 * Servicio de capturas de entorno.
 *
 * orquestar(): CU07 (capturar) + CU08 (reconocer objetos)
 *   1. Sube la imagen a R2 (si está configurado)
 *   2. Registra la captura (estado PROCESANDO)
 *   3. Llama a FastAPI (YOLO) — si el usuario lo pidió
 *   4. Persiste las detecciones
 *   5. Marca PROCESADA y devuelve resumen para TTS
 *
 * Degradación elegante:
 *   - Sin R2     → captura sin archivo (r2_key null)
 *   - Sin FastAPI→ captura queda PENDIENTE con aviso claro
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class CapturasService {
  private readonly logger = new Logger(CapturasService.name);

  constructor(
    @InjectRepository(CapturaEntorno)
    private readonly capturasRepo: Repository<CapturaEntorno>,
    @InjectRepository(DeteccionIA)
    private readonly deteccionesRepo: Repository<DeteccionIA>,
    private readonly r2Service: R2Service,
    private readonly iaClient: VisionIaClient,
  ) {}

  // ═══════════════════ FLUJO PRINCIPAL ═══════════════════

  async orquestar(
    idUsuario: number,
    dto: RegistrarCapturaDto,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<CapturaResponseDto> {
    const accionApp =
      dto.accion_app ??
      (dto.reconocer === false ? undefined : 'RECONOCER_OBJETOS');

    // ─── 1. Subir a R2 (si está configurado) ───
    let r2_key: string | null = null;
    if (this.r2Service.configurado) {
      const subido = await this.r2Service.subirImagen(
        idUsuario,
        archivo.buffer,
        archivo.mimeType,
      );
      r2_key = subido.r2_key;
    }

    // ─── 2. Registrar captura en estado PROCESING ───
    const captura = await this.capturasRepo.save(
      this.capturasRepo.create({
        id_usuario: idUsuario,
        r2_key,
        tipo_captura: dto.tipo_captura ?? 'IMAGEN',
        origen: dto.origen ?? 'CAMARA',
        latitud: dto.latitud ?? null,
        longitud: dto.longitud ?? null,
        estado: 'PROCESANDO' as EstadoCaptura,
        procesada: false,
      }),
    );

    // ─── 3-5. Reconocer con IA (opcional) ───
    if (!accionApp) {
      // CU07 puro: solo captura, queda PENDIENTE para procesar después
      await this.capturasRepo.update(captura.id_captura, {
        estado: 'PENDIENTE',
      });
      return this.obtenerPorId(Number(captura.id_captura), idUsuario);
    }

    let deteccionesDto: DeteccionResponseDto[] = [];
    let iaDisponible = false;
    let resumenVoz: string | null = null;

    try {
      if (accionApp === 'LEER_TEXTO') {
        const resultadoOCR = await this.iaClient.leerTexto(
          archivo.buffer,
          archivo.mimeType,
          archivo.nombre,
          tokenUsuario,
          Number(captura.id_captura),
        );
        iaDisponible = true;
        resumenVoz = resultadoOCR.texto;
      } else {
        const respuestaIA = await this.iaClient.detectarObjetos(
          archivo.buffer,
          archivo.mimeType,
          archivo.nombre,
          tokenUsuario,
          Number(captura.id_captura),
        );
        iaDisponible = true;

        const entidades = this.crearDetecciones(
          Number(captura.id_captura),
          respuestaIA,
        );
        const guardadas =
          entidades.length > 0
            ? await this.deteccionesRepo.save(entidades)
            : [];

        deteccionesDto = guardadas.map((d) => this.mapearDeteccion(d));
        resumenVoz = this.construirResumenVoz(guardadas);
      }

      await this.capturasRepo.update(captura.id_captura, {
        estado: 'PROCESADA',
        procesada: true,
      });
    } catch (error) {
      // IA caída: la captura queda PENDIENTE (reprocesable en Sprint 2).
      // Si el archivo ya se subió, se conserva (no hay rollback: la
      // evidencia visual puede ser útil aunque falle el análisis).
      this.logger.warn(
        `Captura ${captura.id_captura} quedó PENDIENTE: ${error}`,
      );
      await this.capturasRepo.update(captura.id_captura, {
        estado: 'PENDIENTE',
      });

      resumenVoz =
        'No pude analizar la imagen en este momento. ' +
        'La captura quedó guardada para procesarla más tarde.';
    }

    /*return this.construirRespuesta(
      await this.capturasRepo.findOne({
        where: { id_captura: Number(captura.id_captura) },
      })!,
      deteccionesDto,
      resumenVoz,
      iaDisponible,
    );*/

    const capturaActualizada = await this.capturasRepo.findOne({
      where: { id_captura: Number(captura.id_captura) },
    });

    if (!capturaActualizada) {
      throw new NotFoundException(
        `Captura con id ${captura.id_captura} no encontrada después de procesarla.`,
      );
    }

    return this.construirRespuesta(
      capturaActualizada,
      deteccionesDto,
      resumenVoz,
      iaDisponible,
    );
  }

  // ═══════════════════ CONSULTAS ═══════════════════

  /** Mis capturas, paginadas (más recientes primero) */
  async listar(
    idUsuario: number,
    paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<CapturaResponseDto>> {
    const qb = this.capturasRepo
      .createQueryBuilder('captura')
      .where('captura.id_usuario = :idUsuario', { idUsuario })
      .orderBy('captura.fecha_captura', 'DESC')
      .skip(paginacion.skip)
      .take(paginacion.take);

    if (paginacion.buscar) {
      // La búsqueda libre filtra por estado
      qb.andWhere('captura.estado ILIKE :buscar', {
        buscar: `%${paginacion.buscar}%`,
      });
    }

    const [capturas, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      capturas.map((c) => this.construirRespuesta(c, [], null, undefined)),
      total,
      paginacion,
    );
  }

  /** Detalle de una captura propia CON sus detecciones */
  async obtenerPorId(
    idCaptura: number,
    idUsuario: number,
  ): Promise<CapturaResponseDto> {
    const captura = await this.buscarPropia(idCaptura, idUsuario);

    const detecciones = await this.deteccionesRepo.find({
      where: { id_captura: idCaptura },
      order: { confianza: 'DESC' },
    });

    const resumen = detecciones.length
      ? this.construirResumenVoz(detecciones)
      : null;

    return this.construirRespuesta(
      captura,
      detecciones.map((d) => this.mapearDeteccion(d)),
      resumen,
      captura.procesada,
    );
  }

  // ═══════════════════ HELPERS ═══════════════════

  /** Traduce y convierte la respuesta de FastAPI en entidades */
  private crearDetecciones(
    idCaptura: number,
    respuesta: RespuestaDeteccionIA,
  ): DeteccionIA[] {
    return respuesta.detecciones.map((d) =>
      this.deteccionesRepo.create({
        id_captura: idCaptura,
        etiqueta: d.etiqueta,
        categoria: d.categoria,
        confianza: d.confianza,
        x_min: d.x_min,
        y_min: d.y_min,
        x_max: d.x_max,
        y_max: d.y_max,
        modelo_nombre: respuesta.modelo?.nombre ?? null,
        modelo_version: respuesta.modelo?.version ?? null,
      }),
    );
  }

  /** Resumen hablado a partir de las detecciones */
  private construirResumenVoz(detecciones: DeteccionIA[]): string {
    if (detecciones.length === 0) {
      return 'No se detectaron objetos claros en la imagen.';
    }

    // Conteo por etiqueta traducida
    const conteos = new Map<string, number>();
    for (const d of detecciones) {
      const etiqueta = this.traducirEtiqueta(d.etiqueta);
      conteos.set(etiqueta, (conteos.get(etiqueta) ?? 0) + 1);
    }

    const partes = [...conteos.entries()].map(([etiqueta, n]) =>
      n === 1 ? `1 ${etiqueta}` : `${n} ${etiqueta}s`,
    );

    return `Se detectaron: ${partes.join(', ')}.`;
  }

  /** Diccionario de etiquetas COCO → español (ampliable en Sprint 2) */
  private traducirEtiqueta(etiqueta: string): string {
    const diccionario: Record<string, string> = {
      person: 'persona',
      bicycle: 'bicicleta',
      car: 'auto',
      motorcycle: 'motocicleta',
      bus: 'bus',
      truck: 'camión',
      'traffic light': 'semáforo',
      'stop sign': 'señal de stop',
      bench: 'banca',
      dog: 'perro',
      cat: 'gato',
      backpack: 'mochila',
      handbag: 'bolso',
      bottle: 'botella',
      cup: 'taza',
      chair: 'silla',
      'potted plant': 'planta',
      'cell phone': 'teléfono',
      laptop: 'computadora',
      tv: 'pantalla',
      door: 'puerta',
      tree: 'árbol',
    };

    return diccionario[etiqueta.toLowerCase()] ?? etiqueta;
  }

  private async buscarPropia(
    idCaptura: number,
    idUsuario: number,
  ): Promise<CapturaEntorno> {
    const captura = await this.capturasRepo.findOne({
      where: { id_captura: idCaptura },
    });

    // 404 si no existe o es de otro usuario (no filtra existencia)
    if (!captura || Number(captura.id_usuario) !== Number(idUsuario)) {
      //const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException(
        `Captura con id ${idCaptura} no encontrada.`,
      );
    }

    return captura;
  }

  private mapearDeteccion(d: DeteccionIA): DeteccionResponseDto {
    return {
      id_deteccion: Number(d.id_deteccion),
      etiqueta: d.etiqueta,
      etiqueta_es: this.traducirEtiqueta(d.etiqueta),
      categoria: d.categoria,
      confianza: Number(d.confianza),
      bbox: {
        x_min: d.x_min !== null ? Number(d.x_min) : null,
        y_min: d.y_min !== null ? Number(d.y_min) : null,
        x_max: d.x_max !== null ? Number(d.x_max) : null,
        y_max: d.y_max !== null ? Number(d.y_max) : null,
      },
      modelo_nombre: d.modelo_nombre,
      fecha_deteccion: d.fecha_deteccion,
    };
  }

  private construirRespuesta(
    captura: CapturaEntorno,
    detecciones: DeteccionResponseDto[],
    resumenVoz: string | null,
    iaDisponible?: boolean,
  ): CapturaResponseDto {
    return {
      id_captura: Number(captura.id_captura),
      id_usuario: Number(captura.id_usuario),
      r2_key: captura.r2_key,
      url_imagen: this.r2Service.construirUrl(captura.r2_key),
      tipo_captura: captura.tipo_captura,
      origen: captura.origen,
      latitud: captura.latitud !== null ? Number(captura.latitud) : null,
      longitud: captura.longitud !== null ? Number(captura.longitud) : null,
      fecha_captura: captura.fecha_captura,
      procesada: captura.procesada,
      estado: captura.estado,
      detecciones: detecciones.length > 0 ? detecciones : undefined,
      resumen_voz: resumenVoz,
      ia_disponible: iaDisponible,
    };
  }
}