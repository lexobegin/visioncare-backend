import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * ══════════════════════════════════════════════════════
 * DTO: GET /navegaciones (filtros + paginación)
 * `buscar` filtra contra destino_descripcion.
 * ══════════════════════════════════════════════════════
 */
export class NavegacionQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['INICIADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'ERROR'],
    required: false,
  })
  @IsOptional()
  @IsIn(['INICIADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'ERROR'], {
    message:
      'estado solo acepta: INICIADA, EN_CURSO, COMPLETADA, CANCELADA, ERROR.',
  })
  estado?:
    | 'INICIADA'
    | 'EN_CURSO'
    | 'COMPLETADA'
    | 'CANCELADA'
    | 'ERROR';
}
