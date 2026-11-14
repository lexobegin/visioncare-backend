import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * CU21 — Compartir ubicación (el móvil la envía mientras el
 * asistente continuo está activo o el usuario activa el
 * toggle "Compartir mi ubicación").
 * ══════════════════════════════════════════════════════
 */
export class CompartirUbicacionDto {
  @ApiProperty({ example: -17.7833, description: 'Latitud GPS (-90 a 90)' })
  @IsLatitude({ message: 'latitud debe estar entre -90 y 90.' })
  latitud: number;

  @ApiProperty({ example: -63.1821, description: 'Longitud GPS (-180 a 180)' })
  @IsLongitude({ message: 'longitud debe estar entre -180 y 180.' })
  longitud: number;

  @ApiPropertyOptional({
    example: 7.5,
    description: 'Precisión del fix GPS en metros (menor = mejor)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'precision_metros debe ser numérico.' })
  @Min(0, { message: 'precision_metros no puede ser negativo.' })
  precision_metros?: number;

  @ApiPropertyOptional({ example: 416, description: 'Altitud en metros' })
  @IsOptional()
  @IsNumber({}, { message: 'altitud_metros debe ser numérico.' })
  altitud_metros?: number;
}
