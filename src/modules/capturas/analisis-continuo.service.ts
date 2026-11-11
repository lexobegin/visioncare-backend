import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PriorizacionService } from '../alertas/priorizacion.service';
import { Alerta } from '../alertas/entities/alerta.entity';
import { CapturaEntorno } from './entities/captura-entorno.entity';
import { DeteccionIA } from './entities/deteccion-ia.entity';
import type { NivelAlerta, CanalAlerta } from '../alertas/entities/alerta.entity';
import {
  AnalisisContinuoResponseDto,
  AlertaEmitidaDto,
} from './dto/analisis-continuo.dto';
import { VisionIaClient } from './vision-ia.client';
import { R2Service } from '../archivos/r2.service';

import { construirResumenOCR } from './resumenes-voz';

/**
 * ══════════════════════════════════════════════════════
 * Servicio del MODO CONTINUO (manos libres, CU09 + HU17-18).
 *
 * analizarFotograma() — el flujo EFÍMERO:
 *   1. YOLO sobre el fotograma (postImagen — sin persistir)
 *   2. PriorizacionService.decidir() → SILENCIO/INFO/ALERTA
 *   3. SOLO en ALERTA se persiste:
 *        - captura-fantasma tipo FOTOGRAMA (r2_key null —
 *          la imagen NUNCA se guarda: diseño acordado)
 *        - deteccion_ia del riesgo (trazabilidad)
 *        - alerta (nivel/prioridad/canal/mensaje HU18)
 *   4. Canal según severidad (HU18): CRITICO/ALTO →
 *      VOZ_VIBRACION; MEDIO → VOZ; la app ejecuta según CU03.
 *
 * Sin captura → no hay historial (correcto: la narración
 * continua no debe inundar el feed del usuario).
 * ══════════════════════════════════════════════════════
 */

/** Umbral YOLO más alto que el puntual: en continuo exigimos certeza */
const CONFIANZA_MINIMA_CONTINUO = 0.6;

@Injectable()
export class AnalisisContinuoService {
  private readonly logger = new Logger(AnalisisContinuoService.name);

  constructor(
    @InjectRepository(CapturaEntorno)
    private readonly capturasRepo: Repository<CapturaEntorno>,
    @InjectRepository(DeteccionIA)
    private readonly deteccionesRepo: Repository<DeteccionIA>,
    @InjectRepository(Alerta)
    private readonly alertasRepo: Repository<Alerta>,
    private readonly priorizacion: PriorizacionService,
    private readonly iaClient: VisionIaClient,
    private readonly r2Service: R2Service,
  ) {}

  async analizarFotograma(
    idUsuario: number,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    anchoImagen: number,
    altoImagen: number,
    modoBajoConsumo: boolean,
    tokenUsuario?: string,
    latitud?: number,
    longitud?: number,
    precisionGps?: number,
    tipoAnalisis?: 'OCR', // T19
  ): Promise<AnalisisContinuoResponseDto> {
    const inicio = Date.now();

    // ─── T19: LECTURA CONTINUA (OCR efímero, sin priorización YOLO) ───
    if (tipoAnalisis === 'OCR') {
      return this.analizarLecturaContinua(idUsuario, archivo, tokenUsuario);
    }

    // ─── 1. YOLO (efímero: sin idCaptura, sin R2) ───
    let respuestaIA;
    try {
      respuestaIA = await this.iaClient.detectarObjetos(
        archivo.buffer,
        archivo.mimeType,
        archivo.nombre,
        tokenUsuario,
      );
    } catch (error) {
      // IA caída en modo continuo: NO romper el ciclo —
      // la app reintenta al siguiente intervalo
      this.logger.warn(
        `Modo continuo (usuario ${idUsuario}): IA no disponible — ${error}`,
      );
      return {
        nivel_novedad: 'SILENCIO',
        mensaje_voz: null,
        meta: {
          duracion_ms: Date.now() - inicio,
          detecciones: 0,
          siguiente_analisis_ms: 8000, // reintentar con calma
        },
      };
    }

    // Filtrar por confianza (menos ruido que en puntual)
    const detecciones = respuestaIA.detecciones.filter(
      (d) => d.confianza >= CONFIANZA_MINIMA_CONTINUO,
    );

    // ─── 2. Decisión HU17 ───
    const decision = this.priorizacion.decidir(
      idUsuario,
      detecciones,
      anchoImagen,
      altoImagen,
      modoBajoConsumo,
    );

    // ─── 3. ALERTA → persistencia selectiva ───
    let alertaDto: AlertaEmitidaDto | undefined;

    if (
      decision.nivel_novedad === 'ALERTA' &&
      decision.deteccion_riesgo
    ) {
      try {
        const deteccionRiesgo = decision.deteccion_riesgo;

        // 3a. Captura-fantasma (FK anchor — SIN imagen)
        const captura = await this.capturasRepo.save(
          this.capturasRepo.create({
            id_usuario: idUsuario,
            r2_key: null, // ← el fotograma NUNCA se persiste
            tipo_captura: 'FOTOGRAMA',
            origen: 'CAMARA',
            latitud: latitud ?? null,
            longitud: longitud ?? null,
            estado: 'PROCESADA',
            procesada: true,
          }),
        );

        // 3b. Detección del riesgo
        const deteccion = await this.deteccionesRepo.save(
          this.deteccionesRepo.create({
            id_captura: Number(captura.id_captura),
            etiqueta: deteccionRiesgo.etiqueta,
            categoria: deteccionRiesgo.categoria,
            confianza: deteccionRiesgo.confianza,
            x_min: deteccionRiesgo.x_min,
            y_min: deteccionRiesgo.y_min,
            x_max: deteccionRiesgo.x_max,
            y_max: deteccionRiesgo.y_max,
            modelo_nombre: respuestaIA.modelo?.nombre ?? null,
            modelo_version: respuestaIA.modelo?.version ?? null,
          }),
        );

        // 3c. Alerta (HU17/HU18)
        const nivel: NivelAlerta =
          deteccionRiesgo.confianza >= 0.75 ? 'CRITICO' : 'ALTO';
        const canal: CanalAlerta =
          nivel === 'CRITICO' ? 'VOZ_VIBRACION' : 'VOZ';

        const alerta = await this.alertasRepo.save(
          this.alertasRepo.create({
            id_usuario: idUsuario,
            id_deteccion: Number(deteccion.id_deteccion),
            tipo_alerta: this.tipoAlertaDe(deteccionRiesgo.etiqueta),
            nivel,
            mensaje: decision.mensaje_voz ?? 'Riesgo detectado al frente.',
            prioridad: nivel === 'CRITICO' ? 5 : 4,
            canal,
            atendida: false, // el móvil la marca al reproducir
          }),
        );

        alertaDto = {
          id_alerta: Number(alerta.id_alerta),
          tipo_alerta: alerta.tipo_alerta,
          nivel: alerta.nivel,
          prioridad: alerta.prioridad,
          canal: alerta.canal,
          mensaje: alerta.mensaje,
        };

        this.logger.log(
          `🚨 ALERTA ${alerta.nivel} (usuario ${idUsuario}): ${alerta.mensaje}`,
        );
      } catch (e) {
        // Persistencia falló → la voz IGUAL se emite (best-effort)
        this.logger.error(
          `No se pudo persistir la alerta (best-effort): ${e}`,
        );
      }
    }

    return {
      nivel_novedad: decision.nivel_novedad,
      mensaje_voz: decision.mensaje_voz,
      ...(alertaDto && { alerta: alertaDto }),
      meta: {
        duracion_ms: Date.now() - inicio,
        detecciones: detecciones.length,
        siguiente_analisis_ms: decision.siguiente_analisis_ms,
      },
    };
  }

  /** Mapea etiqueta COCO → tipo_alerta de la BD */
  private tipoAlertaDe(etiqueta: string): string {
    const mapa: Record<string, string> = {
      person: 'PERSONA_CERCA',
      car: 'VEHICULO_CERCA',
      motorcycle: 'VEHICULO_CERCA',
      bus: 'VEHICULO_CERCA',
      truck: 'VEHICULO_CERCA',
      bicycle: 'OBSTACULO',
      train: 'VEHICULO_CERCA',
      dog: 'OBSTACULO',
    };
    return mapa[etiqueta.toLowerCase()] ?? 'OBSTACULO';
  }

  /** Último texto OCR narrado por usuario (firma con TTL — no repetir) */
  private readonly ultimosTextosOCR = new Map<
    number,
    { texto: string; ts: number }
  >();

  /** TTL de la firma: el mismo cartel se re-lee tras 60s */
  private static readonly TTL_FIRMA_OCR_MS = 60_000;
  /** Ritmo de la lectura continua (ms entre ciclos) */
  private static readonly INTERVALO_LECTURA_MS = 2500;

  /**
   * LECTURA CONTINUA (T19) — OCR efímero:
   *   - NUNCA persiste (ni texto ni captura)
   *   - texto nuevo     → INFO "El texto dice: ..."
   *   - texto repetido  → SILENCIO (no re-leer)
   *   - sin texto       → SILENCIO (seguir buscando)
   *   - IA caída        → SILENCIO + reintento lento (8s)
   */
  private async analizarLecturaContinua(
    idUsuario: number,
    archivo: { buffer: Buffer; mimeType: string; nombre: string },
    tokenUsuario?: string,
  ): Promise<AnalisisContinuoResponseDto> {
    const inicio = Date.now();
    const intervalo = AnalisisContinuoService.INTERVALO_LECTURA_MS;

    try {
      const ocr = await this.iaClient.leerTexto(
        archivo.buffer,
        archivo.mimeType,
        archivo.nombre,
        tokenUsuario,
      );

      const texto = ocr.texto_extraido.replace(/\s+/g, ' ').trim();

      // Sin texto → seguir buscando
      if (!texto) {
        return {
          nivel_novedad: 'SILENCIO',
          mensaje_voz: null,
          meta: {
            duracion_ms: Date.now() - inicio,
            detecciones: 0,
            siguiente_analisis_ms: intervalo,
          },
        };
      }

      // Firma con TTL: no re-leer el mismo texto reciente
      const firma = this.ultimosTextosOCR.get(idUsuario);
      const firmaVigente =
        firma &&
        firma.texto === texto &&
        Date.now() - firma.ts <
          AnalisisContinuoService.TTL_FIRMA_OCR_MS;

      if (firmaVigente) {
        return {
          nivel_novedad: 'SILENCIO',
          mensaje_voz: null,
          meta: {
            duracion_ms: Date.now() - inicio,
            detecciones: 0,
            siguiente_analisis_ms: intervalo,
          },
        };
      }

      this.ultimosTextosOCR.set(idUsuario, {
        texto,
        ts: Date.now(),
      });

      this.logger.log(
        `📖 Lectura continua (usuario ${idUsuario}): ${texto.slice(0, 60)}...`,
      );

      return {
        nivel_novedad: 'INFO',
        mensaje_voz: construirResumenOCR(ocr),
        meta: {
          duracion_ms: Date.now() - inicio,
          detecciones: 0,
          siguiente_analisis_ms: intervalo,
        },
      };
    } catch (error) {
      // IA caída: NO romper el ciclo de lectura
      this.logger.warn(
        `Lectura continua (usuario ${idUsuario}): IA no disponible — ${error}`,
      );
      return {
        nivel_novedad: 'SILENCIO',
        mensaje_voz: null,
        meta: {
          duracion_ms: Date.now() - inicio,
          detecciones: 0,
          siguiente_analisis_ms: 8000,
        },
      };
    }
  }
}