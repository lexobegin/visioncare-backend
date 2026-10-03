import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta del módulo contactos.
 * ══════════════════════════════════════════════════════
 */
export class ContactoResponseDto {
  @ApiProperty({ example: 1 })
  id_contacto: number;

  @ApiProperty({ example: 1, description: 'Propietario del contacto' })
  id_usuario: number;

  @ApiProperty({ example: 'Rosa Pérez' })
  nombre: string;

  @ApiPropertyOptional({ example: 'Madre', nullable: true })
  parentesco?: string | null;

  @ApiPropertyOptional({ example: '+591 70011122', nullable: true })
  telefono?: string | null;

  @ApiPropertyOptional({ example: 'rosa@correo.com', nullable: true })
  correo?: string | null;

  @ApiProperty({ example: 1, description: 'Orden de notificación (1 = primero)' })
  prioridad: number;

  @ApiProperty({ example: true })
  autorizado_ubicacion: boolean;

  @ApiProperty({ example: true })
  autorizado_emergencias: boolean;

  @ApiProperty({ enum: ['ACTIVO', 'INACTIVO'] })
  estado: string;
}