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
 * DTO: POST /incidentes (CU22)
 *
 * La app envía el GPS que tenga (nunca bloquea el reporte por
 * falta de fix) y hasta 5 evidencias en el form-data.
 * tipo_incidente es texto libre (el modelo SQL no lo restringe)
 * — la app ofrece una lista y permite dictarlo por voz.
 * ══════════════════════════════════════════════════════
 */
export class CrearIncidenteDto {
  @ApiProperty({
    example: 'OBSTRUCCION',
    description: 'Tipo de incidente (texto libre, máx. 80)',
  })
  @IsString({ message: 'tipo_incidente debe ser texto.' })
  @MaxLength(80, { message: 'tipo_incidente no puede superar 80 caracteres.' })
  tipo_incidente: string;

  @ApiPropertyOptional({
    example: 'Puerta del mercado bloqueada con escombros',
    description: 'Descripción dictada o escrita (opcional)',
  })
  @IsOptional()
  @IsString({ message: 'descripcion debe ser texto.' })
  @MaxLength(2000, {
    message: 'descripcion no puede superar 2000 caracteres.',
  })
  descripcion?: string;

  @ApiPropertyOptional({
    enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'],
    default: 'MEDIA',
  })
  @IsOptional()
  @IsIn(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'], {
    message: 'severidad solo acepta: BAJA, MEDIA, ALTA, CRITICA.',
  })
  severidad?: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

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
