import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta del módulo reportes (CU39).
 * `datos` (JSONB) solo viene en el detalle; `url_descarga`
 * solo si el reporte tiene archivo CSV en R2.
 * ══════════════════════════════════════════════════════
 */
export class ReporteResponseDto {
  @ApiProperty({ example: 1 })
  id_reporte: number;

  @ApiPropertyOptional({ nullable: true, description: 'Usuario que lo generó' })
  id_usuario_generador?: number | null;

  @ApiPropertyOptional({ nullable: true })
  id_institucion?: number | null;

  @ApiProperty({
    example: 'USO_APLICACION',
    enum: ['USO_APLICACION', 'PROGRESO_VISIONCOACH', 'INCIDENTES', 'MONITOREO_IA'],
  })
  tipo_reporte: string;

  @ApiPropertyOptional({ example: '2026-10-01', nullable: true })
  periodo_inicio?: string | null;

  @ApiPropertyOptional({ example: '2026-10-31', nullable: true })
  periodo_fin?: string | null;

  @ApiProperty({ example: 'Reporte de uso de la aplicación (histórico)' })
  titulo: string;

  @ApiPropertyOptional({ nullable: true })
  resumen?: string | null;

  @ApiProperty({ enum: ['JSON', 'PDF', 'CSV', 'XLSX'] })
  formato: string;

  @ApiProperty({ example: '2026-11-12T16:00:00.000Z' })
  fecha_generacion: Date;

  @ApiPropertyOptional({ type: Object, description: 'Solo en el detalle' })
  datos?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL pública del CSV en R2 (si formato CSV)',
  })
  url_descarga?: string | null;
}

/** GET /reportes/:id/descargar */
export class DescargaReporteDto {
  @ApiProperty({ example: 1 })
  id_reporte: number;

  @ApiProperty({ example: 'CSV' })
  formato: string;

  @ApiPropertyOptional({ nullable: true })
  r2_key?: string | null;

  @ApiProperty({ example: 'https://…/reportes/1/uuid.csv' })
  url: string | null;
}
