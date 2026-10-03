import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /auth/login  (CU02 — Iniciar sesión)
 * Mensajes intencionales genéricos: no se revela si falló
 * el correo o la contraseña (buena práctica de seguridad).
 * ══════════════════════════════════════════════════════
 */
export class LoginDto {
  @ApiProperty({ example: 'maria@correo.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'correo no tiene un formato válido.' })
  correo: string;

  @ApiProperty({ example: 'Segura*2026' })
  @IsString({ message: 'contrasena debe ser texto.' })
  @MinLength(1, { message: 'contrasena es obligatoria.' })
  contrasena: string;
}