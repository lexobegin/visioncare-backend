import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /contactos/:id  (CU05)
 * Nota: el estado NO se cambia aquí — usar
 * DELETE /:id (desactivar) o PATCH /:id/activar.
 * Si la actualización deja el contacto sin teléfono Y sin
 * correo, la BD lo rechaza (CHECK) y el service traduce
 * el error a un mensaje claro (400).
 * ══════════════════════════════════════════════════════
 */
export class ActualizarContactoDto {
  @ApiPropertyOptional({ example: 'Rosa Pérez' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'nombre debe ser texto.' })
  @MinLength(2, { message: 'nombre debe tener al menos 2 caracteres.' })
  @MaxLength(120, { message: 'nombre no puede superar 120 caracteres.' })
  nombre?: string;

  @ApiPropertyOptional({ example: 'Madre' })
  @IsOptional()
  @IsString({ message: 'parentesco debe ser texto.' })
  @MaxLength(80, { message: 'parentesco no puede superar 80 caracteres.' })
  parentesco?: string;

  @ApiPropertyOptional({ example: '+591 70011122' })
  @IsOptional()
  @Matches(/^[+0-9\s().-]{7,30}$/, {
    message: 'telefono no tiene un formato válido (ej: +591 70011122).',
  })
  telefono?: string;

  @ApiPropertyOptional({ example: 'rosa@correo.com' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'correo no puede superar 150 caracteres.' })
  correo?: string;

  @ApiPropertyOptional({ minimum: 1, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'prioridad debe ser un número entero.' })
  @Min(1, { message: 'prioridad debe ser mayor o igual a 1.' })
  prioridad?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'autorizado_ubicacion debe ser true o false.' })
  autorizado_ubicacion?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'autorizado_emergencias debe ser true o false.' })
  autorizado_emergencias?: boolean;
}