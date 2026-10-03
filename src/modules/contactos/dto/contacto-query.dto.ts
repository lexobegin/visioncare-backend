import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * ══════════════════════════════════════════════════════
 * Query del listado: paginación + filtro de estado.
 * Por defecto solo lista los contactos ACTIVOS.
 * ══════════════════════════════════════════════════════
 */
export class ContactoQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['ACTIVO', 'INACTIVO', 'TODOS'],
    default: 'ACTIVO',
    description: 'Filtrar por estado del contacto',
  })
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO', 'TODOS'], {
    message: 'estado solo acepta: ACTIVO, INACTIVO, TODOS.',
  })
  estado?: 'ACTIVO' | 'INACTIVO' | 'TODOS' = 'ACTIVO';
}