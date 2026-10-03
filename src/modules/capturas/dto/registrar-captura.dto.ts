import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * Campos del formulario multipart (además del archivo).
 *
 * ⚠️ La app móvil debe OMITIR latitud/longitud si no hay GPS
 * (no enviar campos vacíos) para evitar errores de conversión.
 * ══════════════════════════════════════════════════════
 */
export class RegistrarCapturaDto {
  @ApiPropertyOptional({
    enum: ['IMAGEN', 'FOTOGRAMA'],
    default: 'IMAGEN',
    description: 'Tipo de captura (VIDEO se usa en Sprints 2-3)',
  })
  @IsOptional()
  @IsIn(['IMAGEN', 'FOTOGRAMA'], {
    message: 'tipo_captura solo acepta: IMAGEN, FOTOGRAMA.',
  })
  tipo_captura?: 'IMAGEN' | 'FOTOGRAMA';

  @ApiPropertyOptional({
    enum: ['CAMARA', 'GALERIA'],
    default: 'CAMARA',
  })
  @IsOptional()
  @IsIn(['CAMARA', 'GALERIA'], {
    message: 'origen solo acepta: CAMARA, GALERIA.',
  })
  origen?: 'CAMARA' | 'GALERIA';

  @ApiPropertyOptional({ example: -17.7833, minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'latitud debe ser un número.' })
  @Min(-90, { message: 'latitud debe estar entre -90 y 90.' })
  @Max(90, { message: 'latitud debe estar entre -90 y 90.' })
  latitud?: number;

  @ApiPropertyOptional({ example: -63.1821, minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'longitud debe ser un número.' })
  @Min(-180, { message: 'longitud debe estar entre -180 y 180.' })
  @Max(180, { message: 'longitud debe estar entre -180 y 180.' })
  longitud?: number;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description:
      'true = capturar Y reconocer con IA (CU07+CU08). ' +
      'false = solo guardar la captura (CU07).',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'reconocer debe ser true o false.' })
  reconocer?: boolean;
}
