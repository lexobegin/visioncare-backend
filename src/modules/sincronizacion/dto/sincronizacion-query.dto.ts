import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * ══════════════════════════════════════════════════════
 * DTO: GET /sincronizacion — bitácora de mis sincronizaciones.
 * ══════════════════════════════════════════════════════
 */
export class SincronizacionQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['PENDIENTE', 'PROCESANDO', 'SINCRONIZADO', 'ERROR', 'CONFLICTO'],
    required: false,
  })
  @IsOptional()
  @IsIn(['PENDIENTE', 'PROCESANDO', 'SINCRONIZADO', 'ERROR', 'CONFLICTO'], {
    message:
      'estado solo acepta: PENDIENTE, PROCESANDO, SINCRONIZADO, ERROR, CONFLICTO.',
  })
  estado?:
    | 'PENDIENTE'
    | 'PROCESANDO'
    | 'SINCRONIZADO'
    | 'ERROR'
    | 'CONFLICTO';

  @ApiPropertyOptional({
    example: 'android-pixel-7-abc123',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'dispositivo_id debe ser texto.' })
  @MaxLength(150, {
    message: 'dispositivo_id no puede superar 150 caracteres.',
  })
  dispositivo_id?: string;
}
