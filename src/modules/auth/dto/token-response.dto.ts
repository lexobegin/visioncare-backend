import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '../../../common/decorators/roles.decorator';

/**
 * ══════════════════════════════════════════════════════
 * Esquemas de respuesta de autenticación (documentación y
 * contrato de tipos para frontend y app móvil).
 * ══════════════════════════════════════════════════════
 */
export class UsuarioAuthDto {
  @ApiProperty({ example: 1 })
  id_usuario?: number;

  @ApiProperty({ example: 'maria@correo.com' })
  correo?: string;

  @ApiProperty({ enum: ['USUARIO', 'ADMIN', 'INSTITUCION'], example: 'USUARIO' })
  rol?: Rol;

  @ApiProperty({ example: 'María' })
  nombres?: string;

  @ApiProperty({ example: 'González Pérez', nullable: true })
  apellidos?: string;
}

export class TokenResponseDto {
  @ApiProperty({ example: true })
  readonly ok = true;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token JWT — enviar en header: Authorization: Bearer <token>',
  })
  access_token?: string;

  @ApiProperty({ example: 'Bearer' })
  token_type?: string;

  @ApiProperty({
    example: 28800,
    description: 'Segundos de validez del token (según JWT_EXPIRES_IN)',
  })
  expires_in?: number;

  @ApiProperty({ type: UsuarioAuthDto })
  usuario?: UsuarioAuthDto;
}