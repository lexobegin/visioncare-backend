import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { RespuestaDeteccionIA } from '../capturas/vision-ia.contratos';
import type { NivelNovedad } from '../capturas/dto/analisis-continuo.dto';

/**
 * ══════════════════════════════════════════════════════
 * PRIORIZACIÓN DE NARRACIÓN (HU17) — cerebro del MODO CONTINUO.
 *
 * Recibe las detecciones YOLO de un fotograma y decide:
 *
 *   SILENCIO → escena igual a la anterior (no molestar)
 *   INFO     → novedad leve (señal nueva, persona entra)
 *   ALERTA   → riesgo real (obstáculo/vehículo cerca)
 *
 * Componentes:
 *   1. FIRMA de escena: etiquetas normalizadas ordenadas.
 *      Firma igual → SILENCIO (excepto si hay riesgo: el riesgo
 *      SIEMPRE gana, aunque la firma no cambie).
 *   2. SEMÁFORO de etiquetas:
 *      PELIGRO  → obstáculos/móviles (person, car, bicycle…)
 *      ATENCION → señales/semáforos
 *      NEUTRAL  → resto (bench, potted plant…)
 *   3. RIESGO POR TAMAÑO+POSICIÓN (aprox. de distancia sin
 *      profundidad): bbox > UMBRAL del área y en franja
 *      central-baja de la imagen = "cerca/caminando hacia".
 *
 * Estado de escena EN MEMORIA por usuario (Map). Limitación
 * documentada: single-instance; multi-instancia → Redis (S3+).
 * ══════════════════════════════════════════════════════
 */

// ─── Semáforo de etiquetas COCO ───

type CategoriaRiesgo = 'PELIGRO' | 'ATENCION' | 'NEUTRAL';

const SEMAFORO: Record<string, CategoriaRiesgo> = {
  // PELIGRO: móviles/obstáculos dinámicos
  person: 'PELIGRO',
  car: 'PELIGRO',
  motorcycle: 'PELIGRO',
  bicycle: 'PELIGRO',
  bus: 'PELIGRO',
  truck: 'PELIGRO',
  train: 'PELIGRO',
  dog: 'PELIGRO',
  // ATENCION: señalización fija
  'traffic light': 'ATENCION',
  'stop sign': 'ATENCION',
  'fire hydrant': 'ATENCION',
  'parking meter': 'ATENCION',
};

function categoriaDe(etiqueta: string): CategoriaRiesgo {
  return SEMAFORO[etiqueta.toLowerCase()] ?? 'NEUTRAL';
}

// ─── Traducción mínima para mensajes (la canónica vive en la IA;
//     aquí solo las que aparecen en alertas) ───

const TRADUCCION_MENSAJES: Record<string, string> = {
  person: 'una persona',
  car: 'un auto',
  motorcycle: 'una motocicleta',
  bicycle: 'una bicicleta',
  bus: 'un bus',
  truck: 'un camión',
  train: 'un tren',
  dog: 'un perro',
  'traffic light': 'un semáforo',
  'stop sign': 'una señal de stop',
  'fire hydrant': 'un hidrante',
  'parking meter': 'un parquímetro',
};

/** Umbral de área del bbox (%) para considerar "cerca" */
const UMBRAL_CERCA_PCT = 35;
/** Umbral más severo (muy cerca / atraviesa el encuadre) */
const UMBRAL_MUY_CERCA_PCT = 55;

/** Resultado de la decisión para un fotograma */
export interface DecisionPrioridad {
  nivel_novedad: NivelNovedad;
  mensaje_voz: string | null;
  /** Detalle de la detección que provocó ALERTA (para persistir) */
  deteccion_riesgo?: {
    etiqueta: string;
    categoria: string | null;
    confianza: number;
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
  };
  /** ms que la app debe esperar para el próximo fotograma */
  siguiente_analisis_ms: number;
}

/** Estado de escena persistido en memoria por usuario */
interface EstadoEscena {
  /** Firma: etiquetas normalizadas ordenadas, sin duplicados */
  firma: string;
  /** Timestamp del último ALERTA (para seguimiento rápido) */
  ultima_alerta_ms: number;
  /** Última etiqueta de riesgo narrada (evitar repetición inmediata) */
  ultimo_riesgo: string | null;
}

const SEGMENTO_INTERVALO = {
  normal: 3000,
  bajo_consumo: 6000,
  post_alerta: 2000,
} as const;

@Injectable()
export class PriorizacionService {
  private readonly logger = new Logger(PriorizacionService.name);

  /** Estado de escena por usuario (en memoria del proceso) */
  private readonly estados = new Map<number, EstadoEscena>();

  constructor(config: ConfigService) {
    void config; // reservado para umbrales por .env (futuro)
  }

  // ═══════════════════ DECISIÓN ═══════════════════

  /**
   * Decide qué hacer con las detecciones del fotograma.
   *
   * @param idUsuario      dueño del fotograma
   * @param detecciones    salida YOLO (contrato Sprint 1)
   * @param anchoImagen    ancho px del fotograma (para % de bbox)
   * @param altoImagen     alto px
   * @param modoBajoConsumo preferencia CU03 del usuario
   */
  decidir(
    idUsuario: number,
    detecciones: RespuestaDeteccionIA['detecciones'],
    anchoImagen: number,
    altoImagen: number,
    modoBajoConsumo: boolean,
  ): DecisionPrioridad {
    const ahora = Date.now();
    const estado = this.estados.get(idUsuario) ?? {
      firma: '',
      ultima_alerta_ms: 0,
      ultimo_riesgo: null,
    };

    const intervaloBase = modoBajoConsumo
      ? SEGMENTO_INTERVALO.bajo_consumo
      : SEGMENTO_INTERVALO.normal;

    // ─── 1. RIESGO primero (siempre gana, aunque firma no cambie) ───
    const riesgo = this.detectarRiesgo(
      detecciones,
      anchoImagen,
      altoImagen,
      estado.ultimo_riesgo,
    );

    if (riesgo) {
      const enSeguimiento =
        ahora - estado.ultima_alerta_ms < SEGMENTO_INTERVALO.post_alerta * 4;

      // Mismo riesgo que se acaba de narrar y seguimiento activo
      // → bajar a INFO para no encadenar alertas idénticas
      const repetido =
        enSeguimiento && riesgo.etiqueta === estado.ultimo_riesgo;

      estado.ultima_alerta_ms = ahora;
      estado.ultimo_riesgo = riesgo.etiqueta;
      estado.firma = this.firmarEscena(detecciones);
      this.estados.set(idUsuario, estado);

      const ms = repetido
        ? SEGMENTO_INTERVALO.post_alerta
        : intervaloBase;

      return {
        nivel_novedad: 'ALERTA',
        mensaje_voz: this.mensajeRiesgo(riesgo, repetido),
        deteccion_riesgo: {
          etiqueta: riesgo.etiqueta,
          categoria: riesgo.categoria,
          confianza: riesgo.confianza,
          x_min: riesgo.x_min,
          y_min: riesgo.y_min,
          x_max: riesgo.x_max,
          y_max: riesgo.y_max,
        },
        siguiente_analisis_ms: ms,
      };
    }

    // ─── 2. Firma de escena → SILENCIO si no cambió ───
    const firmaNueva = this.firmarEscena(detecciones);
    const sinNovedad = firmaNueva === estado.firma;

    estado.firma = firmaNueva;
    // El riesgo "se olvida" tras 2 ciclos sin riesgos (lo resetea
    // la próxima ALERTA de otra etiqueta o paso del tiempo)
    if (ahora - estado.ultima_alerta_ms > 10000) {
      estado.ultimo_riesgo = null;
    }
    this.estados.set(idUsuario, estado);

    if (sinNovedad) {
      return {
        nivel_novedad: 'SILENCIO',
        mensaje_voz: null,
        siguiente_analisis_ms: intervaloBase,
      };
    }

    // ─── 3. Novedad informativa (escena cambió sin riesgo) ───
    const mensaje = this.mensajeNovedad(detecciones, estado);
    if (!mensaje) {
      // Cambió solo en detalles neutrales → no molestar
      return {
        nivel_novedad: 'SILENCIO',
        mensaje_voz: null,
        siguiente_analisis_ms: intervaloBase,
      };
    }

    return {
      nivel_novedad: 'INFO',
      mensaje_voz: mensaje,
      siguiente_analisis_ms: intervaloBase,
    };
  }

  /** Olvida la escena (p. ej. al desactivar el modo continuo) */
  resetear(idUsuario: number): void {
    this.estados.delete(idUsuario);
  }

  // ═══════════════════ RIESGO ═══════════════════

  private detectarRiesgo(
    detecciones: RespuestaDeteccionIA['detecciones'],
    ancho: number,
    alto: number,
    ultimoRiesgo: string | null,
  ): DecisionPrioridad['deteccion_riesgo'] | null {
    const areaImagen = ancho * alto;
    if (areaImagen <= 0) return null;

    let peor: {
      det: RespuestaDeteccionIA['detecciones'][number];
      pct: number;
      muyCerca: boolean;
    } | null = null;

    for (const det of detecciones) {
      if (categoriaDe(det.etiqueta) !== 'PELIGRO') continue;

      const w = (det.x_max ?? 0) - (det.x_min ?? 0);
      const h = (det.y_max ?? 0) - (det.y_min ?? 0);
      if (w <= 0 || h <= 0) continue;

      const pct = ((w * h) / areaImagen) * 100;
      if (pct < UMBRAL_CERCA_PCT) continue;

      // Franja central-baja: lo que está "delante del usuario"
      const centroX = ((det.x_min ?? 0) + (det.x_max ?? 0)) / 2 / ancho;
      const centroY = ((det.y_min ?? 0) + (det.y_max ?? 0)) / 2 / alto;
      const enCamino = centroX > 0.15 && centroX < 0.85 && centroY > 0.35;
      if (!enCamino) continue;

      const muyCerca = pct >= UMBRAL_MUY_CERCA_PCT;
      if (!peor || pct > peor.pct) {
        peor = { det, pct, muyCerca };
      }
    }

    // Evitar encadenar la MISMA alerta idéntica en cada ciclo
    if (peor && ultimoRiesgo && peor.det.etiqueta === ultimoRiesgo) {
      return null;
    }

    return peor
      ? {
          etiqueta: peor.det.etiqueta,
          categoria: peor.det.categoria,
          confianza: peor.det.confianza,
          x_min: peor.det.x_min ?? 0,
          y_min: peor.det.y_min ?? 0,
          x_max: peor.det.x_max ?? 0,
          y_max: peor.det.y_max ?? 0,
        }
      : null;
  }

  private mensajeRiesgo(
    riesgo: NonNullable<DecisionPrioridad['deteccion_riesgo']>,
    repetido: boolean,
  ): string {
    const nombre =
      TRADUCCION_MENSAJES[riesgo.etiqueta.toLowerCase()] ??
      riesgo.categoria ??
      riesgo.etiqueta;

    if (repetido) {
      return `Sigue ${nombre} delante de ti.`;
    }
    return `Atención: ${nombre} delante de ti.`;
  }

  // ═══════════════════ NOVEDAD ═══════════════════

  /** Firma estable: etiquetas ordenadas, sin duplicados */
  private firmarEscena(
    detecciones: RespuestaDeteccionIA['detecciones'],
  ): string {
    const etiquetas = detecciones
      .map((d) => d.etiqueta.toLowerCase())
      .sort();
    return [...new Set(etiquetas)].join('|');
  }

  /** Mensaje INFO: solo novedades relevantes (PELIGRO lejos / ATENCION) */
  private mensajeNovedad(
    detecciones: RespuestaDeteccionIA['detecciones'],
    estado: EstadoEscena,
  ): string | null {
    // Elegimos la detección más confiable de categoría relevante
    const relevantes = detecciones
      .filter((d) => categoriaDe(d.etiqueta) !== 'NEUTRAL')
      .sort((a, b) => b.confianza - a.confianza);

    for (const d of relevantes) {
      const cat = categoriaDe(d.etiqueta);
      const nombre =
        TRADUCCION_MENSAJES[d.etiqueta.toLowerCase()] ??
        d.categoria ??
        d.etiqueta;

      if (cat === 'ATENCION') {
        // Señales: siempre informativas cuando aparecen
        return `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} detectado al frente.`;
      }

      // PELIGRO lejos (no pasó umbral): info discreta
      if (cat === 'PELIGRO' && d.etiqueta !== estado.ultimo_riesgo) {
        return `Hay ${nombre} cerca de tu recorrido.`;
      }
    }

    // Solo cambios neutrales (bench, plant…) → no narrar
    return null;
  }
}