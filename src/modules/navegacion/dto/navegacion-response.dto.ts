import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta del módulo navegación.
 * El detalle incluye la traza ordenada y métricas calculadas
 * (distancia Haversine, duración) — `mensaje_voz` para TTS.
 * ══════════════════════════════════════════════════════
 */

export class PuntoResponseDto {
  @ApiProperty({ example: 1 })
  id_punto: number;

  @ApiProperty({ example: 3, description: 'Posición en la traza' })
  orden: number;

  @ApiProperty({ example: -17.7835 })
  latitud: number;

  @ApiProperty({ example: -63.1825 })
  longitud: number;

  @ApiPropertyOptional({ example: 'Gire a la derecha', nullable: true })
  instruccion?: string | null;

  @ApiPropertyOptional({ example: 'Entrada con rampa', nullable: true })
  referencia_entorno?: string | null;
}

export class NavegacionResponseDto {
  @ApiProperty({ example: 1 })
  id_navegacion: number;

  @ApiProperty({ example: 7 })
  id_usuario: number;

  @ApiPropertyOptional({ example: -17.7833, nullable: true })
  origen_latitud?: number | null;

  @ApiPropertyOptional({ example: -63.1821, nullable: true })
  origen_longitud?: number | null;

  @ApiPropertyOptional({ example: -17.7901, nullable: true })
  destino_latitud?: number | null;

  @ApiPropertyOptional({ example: -63.1901, nullable: true })
  destino_longitud?: number | null;

  @ApiPropertyOptional({
    example: 'Mercado Municipal, puerta principal',
    nullable: true,
  })
  destino_descripcion?: string | null;

  @ApiProperty({ enum: ['ASISTIDA', 'VOZ', 'MAPA'] })
  modo: string;

  @ApiProperty({
    enum: ['INICIADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'ERROR'],
  })
  estado: string;

  @ApiProperty({ example: '2026-11-12T15:00:00.000Z' })
  fecha_inicio: Date;

  @ApiPropertyOptional({ nullable: true })
  fecha_fin?: Date | null;

  /** Solo en el detalle: traza completa ordenada por `orden` */
  @ApiPropertyOptional({ type: [PuntoResponseDto] })
  puntos?: PuntoResponseDto[];

  /** Solo en el detalle: metros recorridos (Haversine sobre la traza) */
  @ApiPropertyOptional({
    example: 428.7,
    nullable: true,
    description: 'Distancia total calculada (metros)',
  })
  distancia_metros?: number | null;

  /** Solo en el detalle: segundos entre inicio y fin */
  @ApiPropertyOptional({
    example: 612,
    nullable: true,
    description: 'Duración calculada (segundos)',
  })
  duracion_segundos?: number | null;

  @ApiPropertyOptional({
    example: 'Navegación iniciada hacia Mercado Municipal.',
    description: 'Texto listo para TTS',
  })
  mensaje_voz?: string | null;
}
