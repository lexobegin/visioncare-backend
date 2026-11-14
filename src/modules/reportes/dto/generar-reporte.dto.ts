import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

import { TIPOS_REPORTE, FormatoReporte } from '../entities/reporte.entity';

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /reportes (CU39 — web: ADMIN/INSTITUCION)
 *
 * `id_institucion` solo lo respeta ADMIN (para generar un
 * reporte de una institución puntual); INSTITUCION siempre
 * genera el suyo. Sin periodo → histórico completo.
 * PDF/XLSX se aceptan en el contrato pero devuelven 400 en
 * esta versión (solo JSON y CSV implementados).
 * ══════════════════════════════════════════════════════
 */
export class GenerarReporteDto {
  @ApiProperty({ enum: TIPOS_REPORTE, example: 'USO_APLICACION' })
  @IsIn(TIPOS_REPORTE as unknown as string[], {
    message: `tipo_reporte solo acepta: ${TIPOS_REPORTE.join(', ')}.`,
  })
  tipo_reporte: (typeof TIPOS_REPORTE)[number];

  @ApiPropertyOptional({ enum: ['JSON', 'CSV'], default: 'JSON' })
  @IsOptional()
  @IsIn(['JSON', 'CSV', 'PDF', 'XLSX'], {
    message: 'formato solo acepta: JSON, CSV, PDF, XLSX.',
  })
  formato?: FormatoReporte;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString({}, { message: 'periodo_inicio debe ser fecha ISO (YYYY-MM-DD).' })
  periodo_inicio?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateString({}, { message: 'periodo_fin debe ser fecha ISO (YYYY-MM-DD).' })
  periodo_fin?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Solo ADMIN: reporte de esa institución (sin ella: global)',
  })
  @IsOptional()
  @IsInt({ message: 'id_institucion debe ser un número entero.' })
  @Min(1, { message: 'id_institucion debe ser mayor o igual a 1.' })
  id_institucion?: number;
}
