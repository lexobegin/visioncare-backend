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
 * DTO: POST /ayuda/solicitar  (CU20)
 *
 * La app envía el GPS que tenga (nunca bloquea la solicitud
 * por falta de fix) y el tipo según el comando:
 *   "ayuda" → AYUDA | "emergencia" → EMERGENCIA
 * ══════════════════════════════════════════════════════
 */
export class CrearSolicitudDto {
  @ApiProperty({
    enum: ['AYUDA', 'EMERGENCIA', 'ASISTENCIA'],
    default: 'AYUDA',
    description: 'Tipo de solicitud (dictado por voz o botón)',
  })
  @IsIn(['AYUDA', 'EMERGENCIA', 'ASISTENCIA'], {
    message: 'tipo solo acepta: AYUDA, EMERGENCIA, ASISTENCIA.',
  })
  tipo: 'AYUDA' | 'EMERGENCIA' | 'ASISTENCIA';

  @ApiPropertyOptional({
    example: 'Necesito ayuda en la avenida principal',
    description: 'Mensaje dictado por el usuario (opcional)',
  })
  @IsOptional()
  @IsString({ message: 'mensaje debe ser texto.' })
  @MaxLength(500, { message: 'mensaje no puede superar 500 caracteres.' })
  mensaje?: string;

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

  @ApiPropertyOptional({ example: 12.5, description: 'Precisión GPS (metros)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'precision_metros debe ser un número.' })
  @Min(0, { message: 'precision_metros no puede ser negativo.' })
  precision_metros?: number;
}