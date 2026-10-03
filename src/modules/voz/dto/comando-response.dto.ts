import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Respuesta de POST /voz/interpretar.
 * La app móvil lee `accion_app` para ejecutar la función y
 * `respuesta_voz` para el feedback hablado (TTS).
 * ══════════════════════════════════════════════════════
 */
export class ComandoVozResponseDto {
  @ApiProperty({ example: 1 })
  id_comando: number;

  @ApiProperty({ example: 'que ves delante de mi' })
  comando: string;

  @ApiProperty({
    example: 'RECONOCER_OBJETOS',
    description:
      'Código de la intención (RECONOCER_OBJETOS, LEER_TEXTO, ' +
      'SOLICITAR_AYUDA, DESCONOCIDA…)',
  })
  intencion: string;

  @ApiProperty({
    example: 'CU08',
    nullable: true,
    description: 'Caso de uso asociado (null si DESCONOCIDA)',
  })
  caso_uso: string | null;

  @ApiProperty({
    example: 'RECONOCER_OBJETOS',
    description: 'Acción que debe ejecutar la app móvil',
  })
  accion_app: string;

  @ApiProperty({
    example: 'Analizando los objetos de tu entorno.',
    description: 'Texto sugerido para reproducir con TTS',
  })
  respuesta_voz: string;

  @ApiProperty({
    example: 0.6,
    minimum: 0,
    maximum: 1,
    description: 'Confianza total de la interpretación (0–1)',
  })
  confianza: number;

  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  fecha_ejecucion: Date;
}

/**
 * Respuesta de GET /voz/historial (registro persistido).
 */
export class ComandoHistorialDto {
  @ApiProperty({ example: 1 })
  id_comando: number;

  @ApiProperty({ example: 'lee esto' })
  comando: string;

  @ApiPropertyOptional({ example: 'LEER_TEXTO', nullable: true })
  intencion?: string | null;

  @ApiPropertyOptional({
    example: 'Leyendo el texto.',
    nullable: true,
  })
  resultado?: string | null;

  @ApiPropertyOptional({ example: 0.6, nullable: true })
  confianza?: number | null;

  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  fecha_ejecucion: Date;
}

/** Item del catálogo de intenciones (GET /voz/intenciones) */
export class IntencionCatalogoDto {
  @ApiProperty({ example: 'RECONOCER_OBJETOS' })
  codigo: string;

  @ApiProperty({ example: 'CU08' })
  caso_uso: string;

  @ApiProperty({ example: 'Reconocer objetos y personas del entorno' })
  descripcion: string;

  @ApiProperty({ type: [String], example: ['¿qué ves?', '¿qué hay delante?'] })
  ejemplos: string[];

  @ApiProperty({ example: 'RECONOCER_OBJETOS' })
  accion_app: string;
}