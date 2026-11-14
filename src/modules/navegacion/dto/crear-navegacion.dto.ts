import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /navegaciones (CU24)
 * Origen/destino opcionales: la app envía el GPS que tenga
 * al iniciar y el destino conocido (coordenadas o descripción).
 * ══════════════════════════════════════════════════════
 */
export class CrearNavegacionDto {
  @ApiPropertyOptional({
    enum: ['ASISTIDA', 'VOZ', 'MAPA'],
    default: 'ASISTIDA',
  })
  @IsOptional()
  @IsIn(['ASISTIDA', 'VOZ', 'MAPA'], {
    message: 'modo solo acepta: ASISTIDA, VOZ, MAPA.',
  })
  modo?: 'ASISTIDA' | 'VOZ' | 'MAPA';

  @ApiPropertyOptional({
    example: 'Mercado Municipal, puerta principal',
    description: 'Destino en texto (para voz/TTS)',
  })
  @IsOptional()
  @IsString({ message: 'destino_descripcion debe ser texto.' })
  @MaxLength(255, {
    message: 'destino_descripcion no puede superar 255 caracteres.',
  })
  destino_descripcion?: string;

  @ApiPropertyOptional({ example: -17.7833, minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'origen_latitud debe ser un número.' })
  @Min(-90, { message: 'origen_latitud debe estar entre -90 y 90.' })
  @Max(90, { message: 'origen_latitud debe estar entre -90 y 90.' })
  origen_latitud?: number;

  @ApiPropertyOptional({ example: -63.1821, minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'origen_longitud debe ser un número.' })
  @Min(-180, { message: 'origen_longitud debe estar entre -180 y 180.' })
  @Max(180, { message: 'origen_longitud debe estar entre -180 y 180.' })
  origen_longitud?: number;

  @ApiPropertyOptional({ example: -17.7901, minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'destino_latitud debe ser un número.' })
  @Min(-90, { message: 'destino_latitud debe estar entre -90 y 90.' })
  @Max(90, { message: 'destino_latitud debe estar entre -90 y 90.' })
  destino_latitud?: number;

  @ApiPropertyOptional({ example: -63.1901, minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'destino_longitud debe ser un número.' })
  @Min(-180, { message: 'destino_longitud debe estar entre -180 y 180.' })
  @Max(180, { message: 'destino_longitud debe estar entre -180 y 180.' })
  destino_longitud?: number;
}
