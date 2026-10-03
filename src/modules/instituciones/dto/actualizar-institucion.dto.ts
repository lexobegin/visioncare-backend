import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /instituciones/:id  (solo ADMIN)
 * El estado NO se cambia aquí: usa DELETE /:id (desactivar)
 * o PATCH /:id/activar (reactivar).
 * ══════════════════════════════════════════════════════
 */
export class ActualizarInstitucionDto {
  @ApiPropertyOptional({ example: 'Fundación Visión Bolivia' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'nombre debe ser texto.' })
  @MinLength(3, { message: 'nombre debe tener al menos 3 caracteres.' })
  @MaxLength(150, { message: 'nombre no puede superar 150 caracteres.' })
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'descripcion debe ser texto.' })
  @MaxLength(2000, { message: 'descripcion no puede superar 2000 caracteres.' })
  descripcion?: string;

  @ApiPropertyOptional({ example: '+591 2 1234567' })
  @IsOptional()
  @Matches(/^[+0-9\s().-]{7,30}$/, {
    message: 'telefono no tiene un formato válido (ej: +591 2 1234567).',
  })
  telefono?: string;

  @ApiPropertyOptional({ example: 'contacto@fundacion.org' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail({}, { message: 'correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'correo no puede superar 150 caracteres.' })
  correo?: string;

  @ApiPropertyOptional({ example: 'Av. Ballivián 456, Cochabamba' })
  @IsOptional()
  @IsString({ message: 'direccion debe ser texto.' })
  @MaxLength(500, { message: 'direccion no puede superar 500 caracteres.' })
  direccion?: string;
}