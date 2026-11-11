import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta del módulo ayuda.
 * `mensaje_voz` va listo para TTS en el móvil (CU20).
 * `url_mapa` genera el link que recibirán los contactos.
 * ══════════════════════════════════════════════════════
 */

export class DestinatarioResponseDto {
  @ApiProperty({ example: 1 })
  id_destinatario: number;

  @ApiProperty({ example: 3, description: 'Contacto de confianza notificado' })
  id_contacto: number;

  @ApiProperty({ example: 'Rosa Pérez' })
  nombre_contacto: string;

  @ApiProperty({ enum: ['SMS', 'LLAMADA', 'CORREO', 'NOTIFICACION'], example: 'SMS' })
  canal: string;

  @ApiProperty({
    enum: ['PENDIENTE', 'ENVIADO', 'RECIBIDO', 'ERROR'],
    example: 'ENVIADO',
  })
  estado_envio: string;

  @ApiPropertyOptional({ example: '2026-10-12T14:30:05.000Z', nullable: true })
  fecha_envio?: Date | null;
}

export class SolicitudResponseDto {
  @ApiProperty({ example: 1 })
  id_solicitud: number;

  @ApiProperty({ example: 4 })
  id_usuario: number;

  @ApiPropertyOptional({ example: 9, nullable: true })
  id_ubicacion?: number | null;

  @ApiProperty({ enum: ['AYUDA', 'EMERGENCIA', 'ASISTENCIA'] })
  tipo: string;

  @ApiPropertyOptional({ nullable: true })
  mensaje?: string | null;

  @ApiProperty({ enum: ['PENDIENTE', 'ENVIADA', 'ATENDIDA', 'CANCELADA'] })
  estado: string;

  @ApiProperty({ example: '2026-10-12T14:30:00.000Z' })
  fecha_solicitud: Date;

  @ApiPropertyOptional({ nullable: true })
  fecha_resolucion?: Date | null;

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
    description: 'Link de ubicación incluido en las notificaciones',
  })
  url_mapa?: string | null;

  @ApiPropertyOptional({ type: [DestinatarioResponseDto] })
  destinatarios?: DestinatarioResponseDto[];

  @ApiPropertyOptional({
    example: 'Ayuda solicitada. Se notificó a 2 contactos de confianza.',
    description: 'Texto listo para TTS',
  })
  mensaje_voz?: string | null;
}