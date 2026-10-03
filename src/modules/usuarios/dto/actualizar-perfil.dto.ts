import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxDate,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /usuarios/me  (CU04 — Gestionar perfil propio)
 * Solo campos del perfil (nombres, contacto, idioma).
 * El correo y el rol NO se cambian aquí (seguridad).
 * ══════════════════════════════════════════════════════
 */
export class ActualizarPerfilDto {
  @ApiPropertyOptional({ example: 'María Fernanda' })
  @IsOptional()
  @IsString({ message: 'nombres debe ser texto.' })
  @MinLength(2, { message: 'nombres debe tener al menos 2 caracteres.' })
  @MaxLength(100, { message: 'nombres no puede superar 100 caracteres.' })
  nombres?: string;

  @ApiPropertyOptional({ example: 'González Pérez' })
  @IsOptional()
  @IsString({ message: 'apellidos debe ser texto.' })
  @MaxLength(100, { message: 'apellidos no puede superar 100 caracteres.' })
  apellidos?: string;

  @ApiPropertyOptional({ example: '+591 70000000' })
  @IsOptional()
  @Matches(/^[+0-9\s().-]{7,30}$/, {
    message: 'telefono no tiene un formato válido (ej: +591 70000000).',
  })
  telefono?: string;

  @ApiPropertyOptional({ example: '2000-05-15' })
  @IsOptional()
  @IsISO8601(
    {},
    { message: 'fecha_nacimiento debe ser una fecha ISO válida (YYYY-MM-DD).' },
  )
  @MaxDate(() => new Date(), {
    message: 'fecha_nacimiento no puede ser una fecha futura.',
  })
  fecha_nacimiento?: string;

  @ApiPropertyOptional({ enum: ['es', 'en'], example: 'es' })
  @IsOptional()
  @IsIn(['es', 'en'], { message: 'idioma solo acepta: es, en.' })
  idioma?: string;
}