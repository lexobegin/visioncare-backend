import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ══════════════════════════════════════════════════════
 * Cliente HTTP hacia el servicio de IA (FastAPI).
 *
 * Contrato esperado (se implementará en el proyecto IA):
 *
 *   POST {IA_SERVICE_URL}/detecciones/objetos
 *   multipart/form-data: campo "imagen"
 *
 *   200 → {
 *     "modelo": { "nombre": "yolov8n", "version": "1.0" },
 *     "duracion_ms": 230,
 *     "detecciones": [
 *       { "etiqueta": "person", "categoria": "persona",
 *         "confianza": 0.94, "x_min": 10.5, "y_min": 20.1,
 *         "x_max": 150.2, "y_max": 300.9 }
 *     ]
 *   }
 *
 * Usa fetch nativo de Node (≥18, estable en Node 24) —
 * sin dependencias HTTP extra.
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

  /** Envía la imagen a YOLO y devuelve las detecciones */
  async detectarObjetos(
    buffer: Buffer,
    mimeType: string,
    nombreArchivo: string,
    tokenUsuario?: string,
    idCaptura?: number, // 🆕 trazabilidad en registros_ia
  ): Promise<RespuestaDeteccionIA> {
    const url = this.construirUrl('/detecciones/objetos');

    const headers = this.crearHeadersAutenticacion(tokenUsuario);

    try {
      // FormData y Blob son nativos en Node ≥18
      const formulario = new FormData();
      formulario.append(
        'imagen',
        new Blob([new Uint8Array(buffer)], { type: mimeType }),
        nombreArchivo,
      );
      if (idCaptura !== undefined) { // 🆕
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
          `FastAPI respondió HTTP ${respuesta.status}.`,
        );
      }

      const datos = (await respuesta.json()) as RespuestaDeteccionIA;

      if (!Array.isArray(datos.detecciones)) {
        throw new ServiceUnavailableException(
          'El servicio de IA devolvió un formato inesperado.',
        );
      }

      return datos;
    } catch (error) {
      // Timeout / conexión rechazada / DNS → servicio caído
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
        'El servicio de IA no está disponible en este momento. ' +
          'La captura quedó registrada y podrá procesarse más tarde.',
      );
    }
  }

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