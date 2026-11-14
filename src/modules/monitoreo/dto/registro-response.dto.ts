import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta del módulo monitoreo (CU40).
 * `modelo` va incluido para pintar nombre/versión en la web.
 * ══════════════════════════════════════════════════════
 */
export class RegistroResponseDto {
  @ApiProperty({ example: 1 })
  id_registro: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  id_modelo?: number | null;

  @ApiPropertyOptional({ example: 7, nullable: true })
  id_usuario?: number | null;

  @ApiPropertyOptional({ example: 10, nullable: true })
  id_captura?: number | null;

  @ApiProperty({ example: 'RECONOCER_PRODUCTO' })
  tipo_operacion: string;

  @ApiPropertyOptional({ example: 129005, nullable: true })
  duracion_ms?: number | null;

  @ApiProperty({ enum: ['EXITO', 'ERROR', 'ADVERTENCIA'], example: 'EXITO' })
  resultado_estado: string;

  @ApiPropertyOptional({ example: 0.8498, nullable: true })
  confianza?: number | null;

  @ApiPropertyOptional({
    example: 'TimeoutError: ...',
    nullable: true,
  })
  mensaje_error?: string | null;

  @ApiPropertyOptional({
    example: { total_detecciones: 1, umbral: 0.5, dispositivo: 'cpu' },
    nullable: true,
  })
  metadatos?: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-11-11T19:01:45.587Z' })
  fecha_ejecucion: Date;

  @ApiPropertyOptional({
    example: { nombre: 'producto-analyzer', version: '1.0' },
    nullable: true,
  })
  modelo?: { nombre: string; version: string; tipo_modelo: string } | null;
}
