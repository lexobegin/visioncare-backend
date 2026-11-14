import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /navegaciones/:id/puntos (CU24)
 *
 * Si no se envía `orden`, el servidor asigna el siguiente
 * disponible (MAX(orden) + 1). `instruccion` es lo que la guía
 * dictó en ese punto; `referencia_entorno` lo que detectó la IA.
 * ══════════════════════════════════════════════════════
 */
export class AgregarPuntoDto {
  @ApiProperty({ example: -17.7835, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber({}, { message: 'latitud debe ser un número.' })
  @Min(-90, { message: 'latitud debe estar entre -90 y 90.' })
  @Max(90, { message: 'latitud debe estar entre -90 y 90.' })
  latitud: number;

  @ApiProperty({ example: -63.1825, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber({}, { message: 'longitud debe ser un número.' })
  @Min(-180, { message: 'longitud debe estar entre -180 y 180.' })
  @Max(180, { message: 'longitud debe estar entre -180 y 180.' })
  longitud: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Posición en la traza (si falta, se asigna la siguiente)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'orden debe ser un número entero.' })
  @Min(1, { message: 'orden debe ser mayor o igual a 1.' })
  @Max(32767, {
    message: 'orden no puede superar 32767 (límite de la columna SMALLINT).',
  })
  orden?: number;

  @ApiPropertyOptional({ example: 'Gire a la derecha en la esquina' })
  @IsOptional()
  @IsString({ message: 'instruccion debe ser texto.' })
  @MaxLength(1000, {
    message: 'instruccion no puede superar 1000 caracteres.',
  })
  instruccion?: string;

  @ApiPropertyOptional({ example: 'Entrada con rampa a 5 metros' })
  @IsOptional()
  @IsString({ message: 'referencia_entorno debe ser texto.' })
  @MaxLength(1000, {
    message: 'referencia_entorno no puede superar 1000 caracteres.',
  })
  referencia_entorno?: string;
}
