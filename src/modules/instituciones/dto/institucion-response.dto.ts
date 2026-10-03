import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta del módulo instituciones.
 * total_usuarios facilita el dashboard web (CU39).
 * ══════════════════════════════════════════════════════
 */
export class InstitucionResponseDto {
  @ApiProperty({ example: 1 })
  id_institucion: number;

  @ApiProperty({ example: 'Fundación Visión Bolivia' })
  nombre: string;

  @ApiPropertyOptional({ nullable: true })
  descripcion?: string | null;

  @ApiPropertyOptional({ example: '+591 2 1234567', nullable: true })
  telefono?: string | null;

  @ApiPropertyOptional({ example: 'contacto@fundacion.org', nullable: true })
  correo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  direccion?: string | null;

  @ApiProperty({ enum: ['ACTIVA', 'INACTIVA'] })
  estado: string;

  @ApiProperty({
    example: 3,
    description: 'Cantidad de usuarios asignados a la institución',
  })
  total_usuarios: number;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  created_at: Date;
}