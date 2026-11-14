import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * ══════════════════════════════════════════════════════
 * DTO: GET /incidentes (filtros + paginación)
 * Hereda page/limit/buscar de PaginationDto. `buscar` filtra
 * contra tipo_incidente y descripcion.
 * ══════════════════════════════════════════════════════
 */
export class IncidenteQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['ABIERTO', 'EN_REVISION', 'RESUELTO', 'CERRADO'],
    required: false,
  })
  @IsOptional()
  @IsIn(['ABIERTO', 'EN_REVISION', 'RESUELTO', 'CERRADO'], {
    message:
      'estado solo acepta: ABIERTO, EN_REVISION, RESUELTO, CERRADO.',
  })
  estado?: 'ABIERTO' | 'EN_REVISION' | 'RESUELTO' | 'CERRADO';

  @ApiPropertyOptional({
    enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'],
    required: false,
  })
  @IsOptional()
  @IsIn(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'], {
    message: 'severidad solo acepta: BAJA, MEDIA, ALTA, CRITICA.',
  })
  severidad?: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
}
