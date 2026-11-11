import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ResultadoBilleteDto,
  ResultadoColoresDto,
  ResultadoDescripcionDto,
  ResultadoOcrDto,
  ResultadoProductosDto,
  ResultadoSenalesDto,
} from './dto';
import { RespuestaDeteccionIA } from './vision-ia.contratos';

/**
 * ══════════════════════════════════════════════════════
 * Cliente HTTP hacia el servicio de IA (FastAPI).
 *
 * SPRINT 2 — 7 tipos de análisis (catálogo de Tanda 3):
 *
 *   detectarObjetos()    → POST /detecciones/objetos   (CU08/S1)
 *   leerTexto()          → POST /ocr/leer              (CU11)
 *   reconocerSenales()   → POST /senales/reconocer     (CU12)
 *   reconocerProductos() → POST /productos/reconocer   (CU13)
 *   reconocerColores()   → POST /colores/reconocer     (CU14)
 *   reconocerBillete()   → POST /billetes/reconocer    (CU15/16)
 *   describirEscena()    → POST /descripciones/generar (CU10)
 *
 * Todos comparten el método privado postImagen<T>():
 *   - multipart/form-data con el campo "imagen"
 *   - Capa 2: reenvía el JWT del usuario (Authorization)
 *   - Capa 1: X-API-Key si está configurada
 *   - id_captura opcional (trazabilidad en registros_ia)
 *   - timeout + errores normalizados a 503 con mensaje claro
 *
 * Contratos de respuesta = DTOs de ./dto (Tanda 3). La IA
 * (T10–15) debe cumplirlos exactamente.
 * ══════════════════════════════════════════════════════
 */


/** Respuesta esperada de FastAPI */
export interface RespuestaDeteccionIA {
  modelo: { nombre: string; version: string } | null;
  duracion_ms: number | null;
  detecciones: {
    etiqueta: string;
    categoria: string | null;
    confianza: number;
    x_min: number | null;
    y_min: number | null;
    x_max: number | null;
    y_max: number | null;
  }[];
}

/** Respuesta esperada por el endpoint OCR */
export interface RespuestaOCRIA {
  texto: string;
}

@Injectable()
export class VisionIaClient {
  private readonly logger = new Logger(VisionIaClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('IA_SERVICE_URL') ||
      process.env.IA_SERVICE_URL ||
      'http://localhost:8000/api/v1'
    )
      .trim()
      .replace(/\/+$/, '');

    this.timeoutMs =
      parseInt(process.env.IA_SERVICE_TIMEOUT_MS ?? '', 10) || 30000;
    this.apiKey = (config.get<string>('IA_API_KEY') || '').trim();
  }

  get disponible(): boolean {
    return this.baseUrl.length > 0;
  }

  // ═══════════════════════════════════════════════════
  // MÉTODO CENTRAL — toda la comunicación con FastAPI
  // ═══════════════════════════════════════════════════

  /**
   * Envía una imagen a un endpoint de análisis y devuelve la
   * respuesta tipada. Centraliza: FormData, headers de
   * seguridad (JWT usuario + API Key), timeout y errores.
   *
   * @param endpoint      ruta FastAPI (ej: '/ocr/leer')
   * @param camposExtra   form-fields adicionales (id_captura, etc.)
   */
  private async postImagen<T>(
    endpoint: string,
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,

    opciones?: {
      tokenUsuario?: string;
      idCaptura?: number;
      camposExtra?: Record<string, string>;
    },
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Capa 2: reenvía el JWT del usuario (atribución en registros_ia)
    const headers: Record<string, string> = {};
    if (opciones?.tokenUsuario) {
      headers['Authorization'] = opciones.tokenUsuario;
    }


    const headers = this.crearHeadersAutenticacion(tokenUsuario);

    try {
      // FormData y Blob son nativos en Node ≥18
      const formulario = new FormData();
      formulario.append(
        'imagen',
        new Blob([new Uint8Array(buffer)], { type: mimeType }),
        nombreArchivo,
      );

      if (opciones?.idCaptura !== undefined) {
        formulario.append('id_captura', String(opciones.idCaptura));
      }
      if (opciones?.camposExtra) {
        for (const [clave, valor] of Object.entries(
          opciones.camposExtra,
        )) {
          formulario.append(clave, valor);
        }
      }

      const respuesta = await fetch(url, {
        method: 'POST',
        body: formulario,
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        this.logger.error(

          `FastAPI respondió ${respuesta.status} en ${endpoint}: ${detalle.slice(0, 300)}`,

        );
        throw new ServiceUnavailableException(
          `FastAPI respondió HTTP ${respuesta.status}.`,
        );
      }

      return (await respuesta.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;

      this.logger.error(
        `Falló la solicitud a FastAPI: POST ${url}; ${this.detalleError(error)}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de IA no está disponible en este momento. ' +
          'La captura quedó registrada y podrá procesarse más tarde.',
      );
    }
  }

  /** Envía la imagen al endpoint OCR y devuelve el texto reconocido */
  async leerTexto(
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,
    tokenUsuario?: string,
    idCaptura?: number,
  ): Promise<RespuestaOCRIA> {
    const rutaOCR = process.env.IA_OCR_PATH || '/ocr/leer';
    const url = this.construirUrl(rutaOCR);

    const headers = this.crearHeadersAutenticacion(tokenUsuario);

    try {
      const formulario = new FormData();
      formulario.append(
        'imagen',
        new Blob([new Uint8Array(buffer)], { type: mimeType }),
        nombreArchivo,
      );
      if (idCaptura !== undefined) {
        formulario.append('id_captura', String(idCaptura));
      }

      const respuesta = await fetch(url, {
        method: 'POST',
        body: formulario,
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        this.logger.error(
          `FastAPI HTTP error: POST ${url} status=${respuesta.status} ` +
            `statusText="${respuesta.statusText}" response=${detalle}`,
        );
        throw new ServiceUnavailableException(
          `FastAPI OCR respondió HTTP ${respuesta.status}.`,
        );
      }

      const datos = (await respuesta.json()) as RespuestaOCRIA;
      if (!datos || typeof datos.texto !== 'string') {
        throw new ServiceUnavailableException(
          'El servicio OCR devolvió un formato inesperado; se esperaba el campo texto.',
        );
      }

      return datos;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;

      this.logger.error(
        `Falló la solicitud OCR a FastAPI: POST ${url}; ${this.detalleError(error)}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de IA no está disponible en este momento.',
      );
    }
  }

  // ═══════════════════════════════════════════════════
  // CU08 (S1) — OBJETOS — base del Modo Continuo
  // ═══════════════════════════════════════════════════

  /** Detección YOLO de objetos/personas (obstáculos HU09 en continuo) */
  async detectarObjetos(
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,
    tokenUsuario?: string,
    idCaptura?: number,
  ): Promise<RespuestaDeteccionIA> {
    return this.postImagen<RespuestaDeteccionIA>(
      '/detecciones/objetos',
      buffer,
      mimeType,
      nombreArchivo,
      { tokenUsuario, idCaptura },
    );
  }

  // ═══════════════════════════════════════════════════
  // CU11 — OCR (lectura de textos)
  // ═══════════════════════════════════════════════════

  /**
   * Lee textos de la imagen (carteles, etiquetas, precios, menús).
   * Nota: EasyOCR en CPU puede tardar 5–10 s — el timeout global
   * (IA_SERVICE_TIMEOUT_MS=30000) lo cubre con holgura.
   */
  async leerTexto(
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,
    tokenUsuario?: string,
    idCaptura?: number,
  ): Promise<ResultadoOcrDto> {
    return this.postImagen<ResultadoOcrDto>(
      '/ocr/leer',
      buffer,
      mimeType,
      nombreArchivo,
      { tokenUsuario, idCaptura },
    );
  }

  // ═══════════════════════════════════════════════════
  // CU12 — SEÑALES Y LUGARES
  // ═══════════════════════════════════════════════════

  /** Señales, salidas, baños, escaleras, cruces (YOLO + OCR de palabras clave) */
  async reconocerSenales(
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,
    tokenUsuario?: string,
    idCaptura?: number,
  ): Promise<ResultadoSenalesDto> {
    return this.postImagen<ResultadoSenalesDto>(
      '/senales/reconocer',
      buffer,
      mimeType,
      nombreArchivo,
      { tokenUsuario, idCaptura },
    );
  }

  // ═══════════════════════════════════════════════════
  // CU13 — PRODUCTOS
  // ═══════════════════════════════════════════════════

  /** Productos y envases (clase COCO + OCR del empaque) */
  async reconocerProductos(
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,
    tokenUsuario?: string,
    idCaptura?: number,
  ): Promise<ResultadoProductosDto> {
    return this.postImagen<ResultadoProductosDto>(
      '/productos/reconocer',
      buffer,
      mimeType,
      nombreArchivo,
      { tokenUsuario, idCaptura },
    );
  }

  // ═══════════════════════════════════════════════════
  // CU14 — COLORES
  // ═══════════════════════════════════════════════════

  /** Color dominante + secundarios (análisis HSV, respuesta inmediata) */
  async reconocerColores(
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,
    tokenUsuario?: string,
    idCaptura?: number,
  ): Promise<ResultadoColoresDto> {
    return this.postImagen<ResultadoColoresDto>(
      '/colores/reconocer',
      buffer,
      mimeType,
      nombreArchivo,
      { tokenUsuario, idCaptura },
    );
  }

  // ═══════════════════════════════════════════════════
  // CU15/CU16 — BILLETES
  // ═══════════════════════════════════════════════════

  /**
   * Moneda, denominación + estimación VISUAL de autenticidad.
   * ⚠️ El resultado es orientativo — NUNCA certificación
   * (advertencia del modelo SQL, se comunica en la UI).
   */
  async reconocerBillete(
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,
    tokenUsuario?: string,
    idCaptura?: number,
  ): Promise<ResultadoBilleteDto> {
    return this.postImagen<ResultadoBilleteDto>(
      '/billetes/reconocer',
      buffer,
      mimeType,
      nombreArchivo,
      { tokenUsuario, idCaptura },
    );
  }

  // ═══════════════════════════════════════════════════
  // CU10 — DESCRIPCIÓN DE ESCENA
  // ═══════════════════════════════════════════════════

  /** Descripción de la escena (composición espacial desde bboxes) */
  async describirEscena(
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,
    tokenUsuario?: string,
    idCaptura?: number,
  ): Promise<ResultadoDescripcionDto> {
    return this.postImagen<ResultadoDescripcionDto>(
      '/descripciones/generar',
      buffer,
      mimeType,
      nombreArchivo,
      { tokenUsuario, idCaptura },
    );

  private crearHeadersAutenticacion(
    tokenUsuario?: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = tokenUsuario?.trim().replace(/^Bearer\s+/i, '').trim();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;
    return headers;
  }

  private construirUrl(ruta: string): string {
    return `${this.baseUrl}/${ruta.replace(/^\/+/, '')}`;
  }

  private detalleError(error: unknown): string {
    if (!(error instanceof Error)) return String(error);

    const causa = (error as Error & { cause?: unknown }).cause;
    const detalleCausa = causa instanceof Error ? `; cause=${causa.message}` : '';
    return `${error.name}: ${error.message}${detalleCausa}`;

  }
}