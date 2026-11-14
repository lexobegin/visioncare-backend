import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: GET /visioncoach/ejercicios (filtros del catálogo)
 * ══════════════════════════════════════════════════════
 */
export class EjerciciosQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filtrar por categoría' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'id_categoria debe ser un número entero.' })
  @Min(1, { message: 'id_categoria debe ser mayor o igual a 1.' })
  id_categoria?: number;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'dificultad debe ser un número entero.' })
  @Min(1, { message: 'dificultad debe estar entre 1 y 5.' })
  @Max(5, { message: 'dificultad debe estar entre 1 y 5.' })
  dificultad?: number;
}
