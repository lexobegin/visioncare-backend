/**
 * ══════════════════════════════════════════════════════
 * Contrato del endpoint POST /detecciones/objetos (Sprint 1)
 * — extraído del client para reutilización (T6: priorización).
 * ══════════════════════════════════════════════════════
 */

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