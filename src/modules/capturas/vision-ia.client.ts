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

@Injectable()
export class VisionIaClient {
  private readonly logger = new Logger(VisionIaClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('IA_SERVICE_URL') ||
      process.env.IA_SERVICE_URL ||
      'http://localhost:8000/api/v1'
    ).replace(/\/$/, '');

    this.timeoutMs =
      parseInt(process.env.IA_SERVICE_TIMEOUT_MS ?? '', 10) || 30000;
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
    const url = `${this.baseUrl}/detecciones/objetos`;

    // Capa 2: reenvía el JWT del usuario (atribución en registros_ia)
    const headers: Record<string, string> = {};
    if (tokenUsuario) headers['Authorization'] = tokenUsuario;

    // Capa 1: API Key compartida (si está configurada)
    const apiKey = process.env.IA_API_KEY;
    if (apiKey) headers['X-API-Key'] = apiKey;

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
          `FastAPI respondió ${respuesta.status}: ${detalle.slice(0, 300)}`,
        );
        throw new ServiceUnavailableException(
          'El servicio de IA respondió con un error.',
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
        `No se pudo contactar al servicio de IA (${url}): ${error}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de IA no está disponible en este momento. ' +
          'La captura quedó registrada y podrá procesarse más tarde.',
      );
    }
  }
}