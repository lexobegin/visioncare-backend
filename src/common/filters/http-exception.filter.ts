import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * ══════════════════════════════════════════════════════
 * Filtro GLOBAL de excepciones — formato único de errores:
 *
 * {
 *   "ok": false,
 *   "codigo": 404,
 *   "error": "Not Found",
 *   "mensaje": "...",
 *   "detalles": ["..."],          // solo cuando aplica (validaciones)
 *   "ruta": "/api/v1/...",
 *   "timestamp": "2026-..."
 * }
 *
 * Casos cubiertos:
 *   1. HttpException con mensaje string      → formato estándar
 *   2. HttpException con objeto (validaciones del ValidationPipe)
 *   3. Errores no controlados (500)          → detalle oculto en producción
 * ══════════════════════════════════════════════════════
 */
interface DatosError {
  codigo: number;
  error: string;
  mensaje: string;
  detalles: string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Excepciones');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const respuesta = ctx.getResponse<Response>();
    const peticion = ctx.getRequest<Request>();

    const { codigo, error, mensaje, detalles } = this.extraerDatos(excepcion);

    const cuerpo = {
      ok: false as const,
      codigo,
      error,
      mensaje,
      ...(detalles.length > 0 ? { detalles } : {}),
      ruta: peticion.originalUrl,
      timestamp: new Date().toISOString(),
    };

    // 5xx → error con stack (diagnóstico) | 4xx → warning simple
    if (codigo >= 500) {
      this.logger.error(
        `${peticion.method} ${peticion.originalUrl} → ${codigo} ${error}`,
        excepcion instanceof Error ? excepcion.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${peticion.method} ${peticion.originalUrl} → ${codigo} ${error}`,
      );
    }

    respuesta.status(codigo).json(cuerpo);
  }

  /**
   * Normaliza cualquier excepción a DatosError.
   */
  private extraerDatos(excepcion: unknown): DatosError {
    // ─── Caso 1 y 2: HttpException (lanazas por la app o ValidationPipe) ───
    if (excepcion instanceof HttpException) {
      const codigo = excepcion.getStatus();
      const respuesta = excepcion.getResponse();

      // Caso 1: throw new NotFoundException('Usuario no encontrado')
      if (typeof respuesta === 'string') {
        return {
          codigo,
          error: this.tituloEstado(codigo),
          mensaje: respuesta,
          detalles: [],
        };
      }

      // Caso 2: ValidationPipe → { statusCode, message: string[], error }
      const obj = respuesta as Record<string, unknown>;
      const mensajeCrudo = (obj.message as string | string[]) ?? excepcion.message;
      const esLista = Array.isArray(mensajeCrudo);

      return {
        codigo,
        error: (obj.error as string) ?? this.tituloEstado(codigo),
        mensaje: esLista
          ? 'La petición contiene datos inválidos.'
          : (mensajeCrudo as string),
        detalles: esLista ? (mensajeCrudo as string[]) : [],
      };
    }

    // ─── Caso 3: error no controlado (bug, BD caída, etc.) ───
    const esProduccion = process.env.NODE_ENV === 'production';
    const detalleInterno =
      excepcion instanceof Error ? excepcion.message : String(excepcion);

    return {
      codigo: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      mensaje: 'Error interno del servidor. Intenta nuevamente más tarde.',
      // En desarrollo se expone para depurar; en producción se oculta (seguridad)
      detalles: esProduccion ? [] : [detalleInterno],
    };
  }

  /** 'BAD_REQUEST' → 'Bad Request' */
  private tituloEstado(codigo: number): string {
    const nombre = (HttpStatus as unknown as Record<number, string>)[codigo];
    if (!nombre) return 'Error';
    return nombre
      .toLowerCase()
      .split('_')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }
}