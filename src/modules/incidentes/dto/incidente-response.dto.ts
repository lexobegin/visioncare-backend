import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta del módulo incidentes.
 * `mensaje_voz` va listo para TTS en el móvil (CU22);
 * `url_mapa` y `evidencias[].url_publica` para la web (CU38).
 * ══════════════════════════════════════════════════════
 */

export class EvidenciaResponseDto {
  @ApiProperty({ example: 1 })
  id_evidencia: number;

  @ApiProperty({ enum: ['IMAGEN', 'VIDEO', 'AUDIO', 'DOCUMENTO'] })
  tipo_archivo: string;

  @ApiPropertyOptional({ example: 'foto-obstruccion.jpg', nullable: true })
  nombre_archivo?: string | null;

  @ApiPropertyOptional({ example: 'image/jpeg', nullable: true })
  mime_type?: string | null;

  @ApiPropertyOptional({ example: 450820, nullable: true })
  tamano_bytes?: number | null;

  @ApiProperty({ example: '2026-11-12T15:00:00.000Z' })
  fecha_registro: Date;

  @ApiPropertyOptional({
    example: 'https://archivos.visioncare.../evidencias/1/2026/11/uuid.jpg',
    nullable: true,
    description: 'URL pública (si R2_PUBLIC_BASE_URL está configurado)',
  })
  url_publica?: string | null;
}

export class IncidenteResponseDto {
  @ApiProperty({ example: 1 })
  id_incidente: number;

  @ApiProperty({ example: 7 })
  id_usuario: number;

  @ApiPropertyOptional({ example: 9, nullable: true })
  id_ubicacion?: number | null;

  @ApiProperty({ example: 'OBSTRUCCION' })
  tipo_incidente: string;

  @ApiPropertyOptional({ nullable: true })
  descripcion?: string | null;

  @ApiProperty({ enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] })
  severidad: string;

  @ApiProperty({ enum: ['ABIERTO', 'EN_REVISION', 'RESUELTO', 'CERRADO'] })
  estado: string;

  @ApiProperty({ example: '2026-11-12T14:55:00.000Z' })
  fecha_incidente: Date;

  @ApiPropertyOptional({ nullable: true })
  fecha_cierre?: Date | null;

  @ApiPropertyOptional({
    example: { latitud: -17.7833, longitud: -63.1821, precision_metros: 12.5 },
    nullable: true,
  })
  ubicacion?: {
    latitud: number;
    longitud: number;
    precision_metros: number | null;
  } | null;

  @ApiPropertyOptional({
    example: 'https://maps.google.com/?q=-17.7833,-63.1821',
    nullable: true,
  })
  url_mapa?: string | null;

  @ApiPropertyOptional({ type: [EvidenciaResponseDto] })
  evidencias?: EvidenciaResponseDto[];

  @ApiPropertyOptional({
    example: 'Incidente registrado. Se guardaron 2 evidencias.',
    description: 'Texto listo para TTS',
  })
  mensaje_voz?: string | null;
}
