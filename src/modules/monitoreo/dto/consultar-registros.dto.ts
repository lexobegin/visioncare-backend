import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * ══════════════════════════════════════════════════════
 * DTO: GET /monitoreo/registros (CU40)
 * Hereda page/limit/buscar de PaginationDto.
 * ══════════════════════════════════════════════════════
 */
export class ConsultarRegistrosDto extends PaginationDto {
  @ApiPropertyOptional({ example: 7, description: 'Filtrar por usuario' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'id_usuario debe ser un número entero.' })
  @Min(1, { message: 'id_usuario debe ser mayor o igual a 1.' })
  id_usuario?: number;

  @ApiPropertyOptional({
    example: 'RECONOCER_PRODUCTO',
    description: 'Filtrar por operación ejecutada',
  })
  @IsOptional()
  @IsString({ message: 'tipo_operacion debe ser texto.' })
  @MaxLength(50, { message: 'tipo_operacion no puede superar 50 caracteres.' })
  tipo_operacion?: string;

  @ApiPropertyOptional({
    enum: ['EXITO', 'ERROR', 'ADVERTENCIA'],
    example: 'EXITO',
  })
  @IsOptional()
  @IsIn(['EXITO', 'ERROR', 'ADVERTENCIA'], {
    message: 'resultado_estado solo acepta: EXITO, ERROR, ADVERTENCIA.',
  })
  resultado_estado?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Ejecuciones desde esta fecha (ISO)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fecha_desde debe ser una fecha ISO (YYYY-MM-DD).' })
  fecha_desde?: string;

  @ApiPropertyOptional({
    example: '2026-11-12',
    description: 'Ejecuciones hasta esta fecha (ISO)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fecha_hasta debe ser una fecha ISO (YYYY-MM-DD).' })
  fecha_hasta?: string;
}
