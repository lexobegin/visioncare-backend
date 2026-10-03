import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /usuarios/me/contrasena
 * Exige la contraseña actual (evita robo de sesión activa).
 * ══════════════════════════════════════════════════════
 */
export class CambiarContrasenaDto {
  @ApiProperty({ example: 'Segura*2026' })
  @IsString({ message: 'contrasena_actual debe ser texto.' })
  @MinLength(1, { message: 'contrasena_actual es obligatoria.' })
  contrasena_actual: string;

  @ApiProperty({
    example: 'NuevaSegura*2027',
    description:
      'Nueva contraseña: mínimo 8 caracteres, con mayúscula, minúscula y número',
  })
  @IsString({ message: 'contrasena_nueva debe ser texto.' })
  @MinLength(8, { message: 'contrasena_nueva debe tener al menos 8 caracteres.' })
  @Matches(/[A-Z]/, {
    message: 'contrasena_nueva debe contener al menos una letra mayúscula.',
  })
  @Matches(/[a-z]/, {
    message: 'contrasena_nueva debe contener al menos una letra minúscula.',
  })
  @Matches(/[0-9]/, {
    message: 'contrasena_nueva debe contener al menos un número.',
  })
  contrasena_nueva: string;
}