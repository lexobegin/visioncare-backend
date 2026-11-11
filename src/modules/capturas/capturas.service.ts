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
  BilleteReconocido,
  EstimacionAutenticidad,
} from './entities/billete-reconocido.entity';
import { CapturaEntorno, EstadoCaptura } from './entities/captura-entorno.entity';
import { ColorReconocido } from './entities/color-reconocido.entity';
import { DescripcionEntorno } from './entities/descripcion-entorno.entity';
import { DeteccionIA } from './entities/deteccion-ia.entity';
import { LecturaOCR } from './entities/lectura-ocr.entity';
import { ProductoReconocido } from './entities/producto-reconocido.entity';
import { SenalLugar } from './entities/senal-lugar.entity';
import {
  CATALOGO_TIPOS,
  TipoAnalisis,
} from './dto/tipo-analisis.enum';
import {
  CapturaResponseDto,
  DeteccionResponseDto,
  RegistrarCapturaDto,
  ResultadoBilleteDto,
  ResultadoColoresDto,
  ResultadoDescripcionDto,
  ResultadoOcrDto,
  ResultadoSenalesDto,
  ResultadoProductosDto,
  ItemSenalDto,
  ItemProductoDto,
} from './dto';
import { VisionIaClient } from './vision-ia.client';
import { RespuestaDeteccionIA } from './vision-ia.contratos';

import {
  construirResumenBillete,
  construirResumenColores,
  construirResumenObjetos,
  construirResumenOCR,
  construirResumenProductos,
  construirResumenSenales,
  traducirEtiqueta,
} from './resumenes-voz';

/**
 * Resultado interno por tipo — alimenta la respuesta al móvil.
 */
interface ResultadoAnalisisInterno {
  detecciones?: DeteccionResponseDto[];
  lectura_ocr?: ResultadoOcrDto;
  senales?: ItemSenalDto[];
  productos?: ItemProductoDto[];
  colores?: ResultadoColoresDto;
  billete?: ResultadoBilleteDto;
  descripcion?: ResultadoDescripcionDto;
}

/**
 * ══════════════════════════════════════════════════════
 * Servicio de capturas — ORQUESTADOR del Sprint 2.
 *
 * orquestar() (puntual, persistente):
 *   1. R2 (si configurado)
 *   2. Captura en estado PROCESANDO
 *   3. Dispatch por tipo_analisis (CATALOGO_TIPOS):
 *        OBJETOS     → detecciones_ia       (S1, CU08)
 *        OCR         → lecturas_ocr         (CU11)
 *        SENALES     → senales_lugares      (CU12)
 *        PRODUCTOS   → productos_reconocidos(CU13)
 *        COLORES     → colores_reconocidos  (CU14)
 *        BILLETES    → billetes_reconocidos (CU15/16)
 *        DESCRIPCION → descripciones_entorno(CU10)
 *   4. resumen_voz hablable por tipo (nunca silencio)
 *   5. PROCESADA o PENDIENTE (degradación si IA cae)
 *
 * listar()/obtenerPorId(): sin cambios (S1).
 * El MODO CONTINUO (efímero) llega en T6 — reutilizará los
 * métodos de análisis con flag de no-persistencia.
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
    @InjectRepository(LecturaOCR)
    private readonly lecturasRepo: Repository<LecturaOCR>,
    @InjectRepository(SenalLugar)
    private readonly senalesRepo: Repository<SenalLugar>,
    @InjectRepository(ProductoReconocido)
    private readonly productosRepo: Repository<ProductoReconocido>,
    @InjectRepository(ColorReconocido)
    private readonly coloresRepo: Repository<ColorReconocido>,
    @InjectRepository(BilleteReconocido)
    private readonly billetesRepo: Repository<BilleteReconocido>,
    @InjectRepository(DescripcionEntorno)
    private readonly descripcionesRepo: Repository<DescripcionEntorno>,
    private readonly r2Service: R2Service,
    private readonly iaClient: VisionIaClient,
  ) {}

  // ═══════════════════ ORQUESTADOR PUNTUAL ═══════════════════

  async orquestar(
    idUsuario: number,
    dto: RegistrarCapturaDto,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<CapturaResponseDto> {
    const tipo = dto.tipo_analisis ?? TipoAnalisis.OBJETOS;
    const cfg = CATALOGO_TIPOS[tipo];
    const reconocer = dto.reconocer ?? true;

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

    // ─── 2. Registrar captura (PROCESANDO) ───
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
    const idCaptura = Number(captura.id_captura);

    // ─── CU07 puro: sin IA (queda PENDIENTE) ───
    if (!reconocer) {
      await this.capturasRepo.update(idCaptura, { estado: 'PENDIENTE' });
      return this.obtenerPorId(idCaptura, idUsuario);
    }

    // ─── 3. Dispatch por tipo + persistencia + resumen ───
    let resultado: ResultadoAnalisisInterno = {};
    let resumenVoz: string | null = null;
    let iaDisponible = false;

    try {
      switch (tipo) {
        case TipoAnalisis.OBJETOS:
          ({ resultado, resumenVoz } = await this.analizarObjetos(
            idCaptura, archivo, tokenUsuario,
          ));
          break;

        case TipoAnalisis.OCR:
          ({ resultado, resumenVoz } = await this.analizarOCR(
            idCaptura, archivo, tokenUsuario,
          ));
          break;

        case TipoAnalisis.SENALES:
          ({ resultado, resumenVoz } = await this.analizarSenales(
            idCaptura, archivo, tokenUsuario,
          ));
          break;

        case TipoAnalisis.PRODUCTOS:
          ({ resultado, resumenVoz } = await this.analizarProductos(
            idCaptura, archivo, tokenUsuario,
          ));
          break;

        case TipoAnalisis.COLORES:
          ({ resultado, resumenVoz } = await this.analizarColores(
            idCaptura, archivo, tokenUsuario,
          ));
          break;

        case TipoAnalisis.BILLETES:
          ({ resultado, resumenVoz } = await this.analizarBilletes(
            idCaptura, archivo, tokenUsuario,
          ));
          break;

        case TipoAnalisis.DESCRIPCION:
          ({ resultado, resumenVoz } = await this.analizarDescripcion(
            idCaptura, archivo, tokenUsuario,
          ));
          break;

        default:
          throw new Error(`Tipo de análisis no soportado: ${tipo}`);
      }

      iaDisponible = true;
      await this.capturasRepo.update(idCaptura, {
        estado: 'PROCESADA',
        procesada: true,
      });
    } catch (error) {
      // IA caída / error de análisis: PENDIENTE (reprocesable) + voz
      this.logger.warn(
        `Captura ${idCaptura} (${tipo}) quedó PENDIENTE: ${error}`,
      );
      await this.capturasRepo.update(idCaptura, { estado: 'PENDIENTE' });

      resumenVoz =
        'No pude analizar la imagen en este momento. ' +
        'La captura quedó guardada para procesarla más tarde.';
    }

    const capturaActualizada = await this.capturasRepo.findOne({
      where: { id_captura: idCaptura },
    });
    if (!capturaActualizada) {
      throw new NotFoundException(
        `Captura ${idCaptura} no encontrada tras el análisis.`,
      );
    }

    return this.construirRespuesta(
      capturaActualizada,
      resultado,
      resumenVoz,
      iaDisponible,
      tipo,
    );
  }

  // ═══════════════ ANALIZADORES POR TIPO ═══════════════
  // Cada uno: llama IA → persiste → arma resultado + resumen_voz

  /** CU08 — YOLO (S1) — base también del modo continuo */
  private async analizarObjetos(
    idCaptura: number,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<{ resultado: ResultadoAnalisisInterno; resumenVoz: string }> {
    const respuesta = await this.iaClient.detectarObjetos(
      archivo.buffer,
      archivo.mimeType,
      archivo.nombre,
      tokenUsuario,
      idCaptura,
    );

    const entidades = this.crearDetecciones(idCaptura, respuesta);
    const guardadas =
      entidades.length > 0
        ? await this.deteccionesRepo.save(entidades)
        : [];

    return {
      resultado: {
        detecciones: guardadas.map((d) => this.mapearDeteccion(d)),
      },
      resumenVoz: construirResumenObjetos(guardadas),
    };
  }

  /** CU11 — OCR → lecturas_ocr */
  private async analizarOCR(
    idCaptura: number,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<{ resultado: ResultadoAnalisisInterno; resumenVoz: string }> {
    const ocr = await this.iaClient.leerTexto(
      archivo.buffer,
      archivo.mimeType,
      archivo.nombre,
      tokenUsuario,
      idCaptura,
    );

    await this.lecturasRepo.save(
      this.lecturasRepo.create({
        id_captura: idCaptura,
        texto_extraido: ocr.texto_extraido,
        idioma: ocr.idioma,
        confianza: ocr.confianza,
        tipo_documento: ocr.tipo_documento,
      }),
    );

    return {
      resultado: { lectura_ocr: ocr },
      resumenVoz: construirResumenOCR(ocr),
    };
  }

  /** CU12 — señales → senales_lugares */
  private async analizarSenales(
    idCaptura: number,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<{ resultado: ResultadoAnalisisInterno; resumenVoz: string }> {
    const r = await this.iaClient.reconocerSenales(
      archivo.buffer,
      archivo.mimeType,
      archivo.nombre,
      tokenUsuario,
      idCaptura,
    );

    if (r.senales.length > 0) {
      await this.senalesRepo.save(
        r.senales.map((s) =>
          this.senalesRepo.create({
            id_captura: idCaptura,
            tipo_senal: s.tipo_senal,
            nombre_reconocido: s.nombre_reconocido,
            descripcion: s.descripcion,
            confianza: s.confianza,
          }),
        ),
      );
    }

    return {
      resultado: { senales: r.senales },
      resumenVoz: construirResumenSenales(r),
    };
  }

  /** CU13 — productos → productos_reconocidos */
  private async analizarProductos(
    idCaptura: number,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<{ resultado: ResultadoAnalisisInterno; resumenVoz: string }> {
    const r = await this.iaClient.reconocerProductos(
      archivo.buffer,
      archivo.mimeType,
      archivo.nombre,
      tokenUsuario,
      idCaptura,
    );

    if (r.productos.length > 0) {
      await this.productosRepo.save(
        r.productos.map((p) =>
          this.productosRepo.create({
            id_captura: idCaptura,
            nombre_producto: p.nombre_producto,
            marca: p.marca,
            categoria: p.categoria,
            descripcion: p.descripcion,
            confianza: p.confianza,
          }),
        ),
      );
    }

    return {
      resultado: { productos: r.productos },
      resumenVoz: construirResumenProductos(r),
    };
  }

  /** CU14 — colores → colores_reconocidos */
  private async analizarColores(
    idCaptura: number,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<{ resultado: ResultadoAnalisisInterno; resumenVoz: string }> {
    const r = await this.iaClient.reconocerColores(
      archivo.buffer,
      archivo.mimeType,
      archivo.nombre,
      tokenUsuario,
      idCaptura,
    );

    await this.coloresRepo.save(
      this.coloresRepo.create({
        id_captura: idCaptura,
        color_principal: r.color_principal,
        colores_secundarios: r.colores_secundarios?.join(', ') ?? null,
        confianza: r.confianza,
      }),
    );

    return {
      resultado: { colores: r },
      resumenVoz: construirResumenColores(r),
    };
  }

  /** CU15/CU16 — billetes → billetes_reconocidos */
  private async analizarBilletes(
    idCaptura: number,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<{ resultado: ResultadoAnalisisInterno; resumenVoz: string }> {
    const r = await this.iaClient.reconocerBillete(
      archivo.buffer,
      archivo.mimeType,
      archivo.nombre,
      tokenUsuario,
      idCaptura,
    );

    await this.billetesRepo.save(
      this.billetesRepo.create({
        id_captura: idCaptura,
        moneda: r.moneda,
        denominacion: r.denominacion,
        confianza: r.confianza,
        autenticidad_estimacion: r.autenticidad_estimacion,
        confianza_autenticidad: r.confianza_autenticidad,
        observaciones: r.observaciones,
      }),
    );

    return {
      resultado: { billete: r },
      resumenVoz: construirResumenBillete(r),
    };
  }

  /** CU10 — descripción → descripciones_entorno */
  private async analizarDescripcion(
    idCaptura: number,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<{ resultado: ResultadoAnalisisInterno; resumenVoz: string }> {
    const r = await this.iaClient.describirEscena(
      archivo.buffer,
      archivo.mimeType,
      archivo.nombre,
      tokenUsuario,
      idCaptura,
    );

    await this.descripcionesRepo.save(
      this.descripcionesRepo.create({
        id_captura: idCaptura,
        descripcion: r.descripcion,
        resumen: r.resumen,
        confianza: r.confianza,
      }),
    );

    // La IA ya entrega el resumen listo para TTS
    return {
      resultado: { descripcion: r },
      resumenVoz: r.resumen,
    };
  }

  // ═══════════════════ CONSULTAS (S1, sin cambios) ═══════════════════

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
      qb.andWhere('captura.estado ILIKE :buscar', {
        buscar: `%${paginacion.buscar}%`,
      });
    }

    const [capturas, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      capturas.map((c) => this.construirRespuesta(c, {}, null, undefined)),
      total,
      paginacion,
    );
  }

  /** Detalle con TODOS los resultados asociados (cualquier tipo) */
  async obtenerPorId(
    idCaptura: number,
    idUsuario: number,
  ): Promise<CapturaResponseDto> {
    const captura = await this.buscarPropia(idCaptura, idUsuario);

    const resultado: ResultadoAnalisisInterno = {};

    const detecciones = await this.deteccionesRepo.find({
      where: { id_captura: idCaptura },
      order: { confianza: 'DESC' },
    });
    if (detecciones.length > 0) {
      resultado.detecciones = detecciones.map((d) =>
        this.mapearDeteccion(d),
      );
    }

    const lectura = await this.lecturasRepo.findOne({
      where: { id_captura: idCaptura },
      order: { fecha_lectura: 'DESC' },
    });
    if (lectura) {
      resultado.lectura_ocr = {
        texto_extraido: lectura.texto_extraido,
        idioma: lectura.idioma,
        confianza: lectura.confianza !== null ? Number(lectura.confianza) : null,
        tipo_documento: lectura.tipo_documento,
      };
    }

    const senales = await this.senalesRepo.find({
      where: { id_captura: idCaptura },
      order: { confianza: 'DESC' },
    });
    if (senales.length > 0) {
      resultado.senales = senales.map((s) => ({
        tipo_senal: s.tipo_senal,
        nombre_reconocido: s.nombre_reconocido,
        descripcion: s.descripcion,
        confianza: s.confianza !== null ? Number(s.confianza) : null,
      }));
    }

    const productos = await this.productosRepo.find({
      where: { id_captura: idCaptura },
      order: { confianza: 'DESC' },
    });
    if (productos.length > 0) {
      resultado.productos = productos.map((p) => ({
        nombre_producto: p.nombre_producto,
        marca: p.marca,
        categoria: p.categoria,
        descripcion: p.descripcion,
        confianza: p.confianza !== null ? Number(p.confianza) : null,
      }));
    }

    const color = await this.coloresRepo.findOne({
      where: { id_captura: idCaptura },
      order: { fecha_deteccion: 'DESC' },
    });
    if (color) {
      resultado.colores = {
        color_principal: color.color_principal,
        colores_secundarios: color.colores_secundarios
          ? color.colores_secundarios.split(',').map((c) => c.trim())
          : null,
        confianza: color.confianza !== null ? Number(color.confianza) : null,
      };
    }

    const billete = await this.billetesRepo.findOne({
      where: { id_captura: idCaptura },
      order: { fecha_deteccion: 'DESC' },
    });
    if (billete) {
      resultado.billete = {
        moneda: billete.moneda,
        denominacion: billete.denominacion,
        confianza: billete.confianza !== null ? Number(billete.confianza) : null,
        autenticidad_estimacion: billete.autenticidad_estimacion,
        confianza_autenticidad:
          billete.confianza_autenticidad !== null
            ? Number(billete.confianza_autenticidad)
            : null,
        observaciones: billete.observaciones,
      };
    }

    const descripcion = await this.descripcionesRepo.findOne({
      where: { id_captura: idCaptura },
      order: { fecha_generacion: 'DESC' },
    });
    if (descripcion) {
      resultado.descripcion = {
        descripcion: descripcion.descripcion,
        resumen: descripcion.resumen ?? descripcion.descripcion,
        confianza:
          descripcion.confianza !== null ? Number(descripcion.confianza) : null,
      };
    }

    // Resumen general para voz del detalle (el más reciente disponible)
    const resumen =
      resultado.descripcion?.resumen ??
      (resultado.billete
        ? construirResumenBillete(resultado.billete)
        : null) ??
      (resultado.lectura_ocr
        ? construirResumenOCR(resultado.lectura_ocr)
        : null) ??
      (detecciones.length > 0
        ? construirResumenObjetos(detecciones)
        : null);

    return this.construirRespuesta(
      captura,
      resultado,
      resumen,
      captura.procesada,
    );
  }

  // ═══════════════════ HELPERS ═══════════════════

  /** Traduce y convierte la respuesta YOLO en entidades (S1) */
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

  private async buscarPropia(
    idCaptura: number,
    idUsuario: number,
  ): Promise<CapturaEntorno> {
    const captura = await this.capturasRepo.findOne({
      where: { id_captura: idCaptura },
    });

    if (!captura || Number(captura.id_usuario) !== Number(idUsuario)) {
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
      etiqueta_es: traducirEtiqueta(d.etiqueta),
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
    resultado: ResultadoAnalisisInterno,
    resumenVoz: string | null,
    iaDisponible?: boolean,
    tipo?: TipoAnalisis,
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
      ...(tipo !== undefined && { tipo_analisis: tipo }),
      ...(resultado.detecciones && { detecciones: resultado.detecciones }),
      ...(resultado.lectura_ocr && { lectura_ocr: resultado.lectura_ocr }),
      ...(resultado.senales && { senales: resultado.senales }),
      ...(resultado.productos && { productos: resultado.productos }),
      ...(resultado.colores && { colores: resultado.colores }),
      ...(resultado.billete && { billete: resultado.billete }),
      ...(resultado.descripcion && {
        descripcion: resultado.descripcion,
      }),
      resumen_voz: resumenVoz,
      ia_disponible: iaDisponible,
    };
  }
}