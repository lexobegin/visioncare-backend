import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TIPOS_REPORTE } from '../entities/reporte.entity';

/**
 * ══════════════════════════════════════════════════════
 * DTO: GET /reportes — listado con filtros.
 * `id_institucion` solo filtra para ADMIN (INSTITUCION ve lo
 * suyo por regla de negocio en el service).
 * ══════════════════════════════════════════════════════
 */
export class ReporteQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TIPOS_REPORTE, required: false })
  @IsOptional()
  @IsIn(TIPOS_REPORTE as unknown as string[], {
    message: `tipo_reporte solo acepta: ${TIPOS_REPORTE.join(', ')}.`,
  })
  tipo_reporte?: (typeof TIPOS_REPORTE)[number];

  @ApiPropertyOptional({ example: 2, required: false, description: 'Solo ADMIN' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'id_institucion debe ser un número entero.' })
  @Min(1, { message: 'id_institucion debe ser mayor o igual a 1.' })
  id_institucion?: number;
}
