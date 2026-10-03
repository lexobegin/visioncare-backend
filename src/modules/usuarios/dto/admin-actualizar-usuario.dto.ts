import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EstadoUsuario,
  RolUsuario,
} from '../entities/usuario.entity';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /usuarios/:id  (CU34 — solo ADMIN)
 * Permite cambiar correo, rol, estado e institución.
 *
 * Nota: al poner estado INACTIVO o BLOQUEADO, los tokens
 * activos del usuario dejan de servir INMEDIATAMENTE
 * (JwtStrategy valida el estado en BD en cada petición).
 * ══════════════════════════════════════════════════════
 */
export class AdminActualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'nuevo@correo.com' })
  @IsOptional()
  @IsEmail({}, { message: 'correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'correo no puede superar 150 caracteres.' })
  correo?: string;

  @ApiPropertyOptional({ enum: ['USUARIO', 'ADMIN', 'INSTITUCION'] })
  @IsOptional()
  @IsIn(['USUARIO', 'ADMIN', 'INSTITUCION'], {
    message: 'rol solo acepta: USUARIO, ADMIN, INSTITUCION.',
  })
  rol?: RolUsuario;

  @ApiPropertyOptional({ enum: ['ACTIVO', 'INACTIVO', 'BLOQUEADO'] })
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO', 'BLOQUEADO'], {
    message: 'estado solo acepta: ACTIVO, INACTIVO, BLOQUEADO.',
  })
  estado?: EstadoUsuario;

  @ApiPropertyOptional({
    description:
      'ID de la institución. Enviar null para quitar la institución actual.',
    type: Number,
    nullable: true,
  })
  @IsOptional()
  @IsInt({ message: 'id_institucion debe ser un número entero.' })
  @Min(1, { message: 'id_institucion debe ser mayor o igual a 1.' })
  id_institucion?: number | null;
}