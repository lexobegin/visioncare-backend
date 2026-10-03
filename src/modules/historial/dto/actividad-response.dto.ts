import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato unificado del feed de historial (CU37/CU23).
 *
 * `id` es único entre fuentes (prefijo + id de origen) para
 * que el frontend lo use como key de lista sin colisiones.
 * ══════════════════════════════════════════════════════
 */
export class ActividadResponseDto {
  @ApiProperty({
    example: 'voz-12',
    description:
      'Identificador único del ítem (prefijo por fuente + id de origen)',
  })
  id: string;

  @ApiProperty({
    enum: ['EVENTO', 'VOZ', 'CAPTURA'],
    description: 'Fuente del evento',
  })
  fuente: 'EVENTO' | 'VOZ' | 'CAPTURA';

  @ApiProperty({
    example: 'COMANDO_VOZ',
    description:
      'Tipo de actividad (TIPOS_ACTIVIDAD, COMANDO_VOZ o CAPTURA_ENTORNO)',
  })
  tipo_actividad: string;

  @ApiPropertyOptional({
    example: 'Comando de voz: ¿qué ves?',
    nullable: true,
  })
  descripcion?: string | null;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description: 'ID del registro de origen (id_comando, id_captura…)',
  })
  referencia_id?: number | null;

  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  fecha: Date;
}

/** Item del resumen por tipo (GET /historial/resumen) */
export class ResumenActividadDto {
  @ApiProperty({ example: 'COMANDO_VOZ' })
  tipo_actividad: string;

  @ApiProperty({ example: 'VOZ' })
  fuente: string;

  @ApiProperty({ example: 42 })
  total: number;
}