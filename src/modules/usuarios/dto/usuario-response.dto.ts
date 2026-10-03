import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta de usuario — NUNCA expone
 * contrasena_hash ni campos técnicos sensibles.
 * Usado por todos los endpoints del módulo.
 * ══════════════════════════════════════════════════════
 */
export class PerfilResponseDto {
  @ApiProperty({ example: 1 })
  id_perfil: number;

  @ApiProperty({ example: 'María' })
  nombres: string;

  @ApiProperty({ example: 'González Pérez', nullable: true })
  apellidos?: string | null;

  @ApiProperty({ example: '+591 70000000', nullable: true })
  telefono?: string | null;

  @ApiProperty({ example: '2000-05-15', nullable: true })
  fecha_nacimiento?: string | null;

  @ApiProperty({ example: 'es' })
  idioma: string;

  @ApiPropertyOptional({
    description: 'Referencia de la foto en Cloudflare R2',
    nullable: true,
  })
  foto_r2_key?: string | null;
}

export class UsuarioResponseDto {
  @ApiProperty({ example: 1 })
  id_usuario: number;

  @ApiProperty({ example: 'maria@correo.com' })
  correo: string;

  @ApiProperty({ enum: ['USUARIO', 'ADMIN', 'INSTITUCION'] })
  rol: string;

  @ApiProperty({ enum: ['ACTIVO', 'INACTIVO', 'BLOQUEADO'] })
  estado: string;

  @ApiProperty({
    example: 1,
    nullable: true,
    description: 'Institución asignada (null = usuario libre)',
  })
  id_institucion?: number | null;

  @ApiProperty({
    example: '2026-09-14T10:30:00.000Z',
    nullable: true,
    description: 'Último inicio de sesión',
  })
  ultimo_acceso?: Date | null;

  @ApiProperty({ example: '2026-09-14T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ type: PerfilResponseDto, nullable: true })
  perfil?: PerfilResponseDto | null;
}