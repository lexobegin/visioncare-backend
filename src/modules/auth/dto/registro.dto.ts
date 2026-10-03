import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxDate,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO anidado: datos personales del perfil (tabla perfiles)
 * Se envía dentro de RegistroDto.perfil
 * ══════════════════════════════════════════════════════
 */
export class RegistroPerfilDto {
  /** Nombres — obligatorio (tabla perfiles: nombres NOT NULL) */
  @ApiProperty({ example: 'María', description: 'Nombres del usuario' })
  @IsString({ message: 'nombres debe ser texto.' })
  @MinLength(2, { message: 'nombres debe tener al menos 2 caracteres.' })
  @MaxLength(100, { message: 'nombres no puede superar 100 caracteres.' })
  nombres: string;

  @ApiPropertyOptional({ example: 'González Pérez' })
  @IsOptional()
  @IsString({ message: 'apellidos debe ser texto.' })
  @MaxLength(100, { message: 'apellidos no puede superar 100 caracteres.' })
  apellidos: string;

  @ApiPropertyOptional({
    example: '+591 70000000',
    description: 'Teléfono de contacto (opcional)',
  })
  @IsOptional()
  @Matches(/^[+0-9\s().-]{7,30}$/, {
    message: 'telefono no tiene un formato válido (ej: +591 70000000).',
  })
  telefono: string;

  @ApiPropertyOptional({
    example: '2000-05-15',
    description: 'Fecha de nacimiento en formato ISO (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsISO8601(
    {},
    { message: 'fecha_nacimiento debe ser una fecha ISO válida (YYYY-MM-DD).' },
  )
  @MaxDate(() => new Date(), {
    message: 'fecha_nacimiento no puede ser una fecha futura.',
  })
  fecha_nacimiento: string;

  @ApiPropertyOptional({
    enum: ['es', 'en'],
    default: 'es',
    description: 'Idioma preferido de la aplicación',
  })
  @IsOptional()
  @IsIn(['es', 'en'], { message: 'idioma solo acepta: es, en.' })
  idioma: string;
}

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /auth/registro  (CU01 — Registrar usuario)
 *
 * Nota de seguridad: el rol NO se recibe aquí. Todo registro
 * público crea un USUARIO. Los roles ADMIN/INSTITUCION se
 * asignan desde la gestión de usuarios (CU34, Sprint 1).
 * ══════════════════════════════════════════════════════
 */
export class RegistroDto {
  @ApiProperty({
    example: 'maria@correo.com',
    description: 'Correo electrónico (único, usado para login)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'correo no puede superar 150 caracteres.' })
  correo: string;

  @ApiProperty({
    example: 'Segura*2026',
    description:
      'Contraseña: mínimo 8 caracteres, con mayúscula, minúscula y número',
  })
  @IsString({ message: 'contrasena debe ser texto.' })
  @MinLength(8, { message: 'contrasena debe tener al menos 8 caracteres.' })
  @Matches(/[A-Z]/, {
    message: 'contrasena debe contener al menos una letra mayúscula.',
  })
  @Matches(/[a-z]/, {
    message: 'contrasena debe contener al menos una letra minúscula.',
  })
  @Matches(/[0-9]/, { message: 'contrasena debe contener al menos un número.' })
  contrasena: string;

  @ApiProperty({
    type: RegistroPerfilDto,
    description: 'Datos personales del perfil',
  })
  @ValidateNested({ message: 'perfil es obligatorio.' })
  @Type(() => RegistroPerfilDto)
  perfil: RegistroPerfilDto;
}