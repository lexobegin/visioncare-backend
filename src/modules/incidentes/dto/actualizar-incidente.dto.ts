import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /incidentes/:id/estado
 *
 * - ADMIN/INSTITUCION (CU38): cualquier estado + severidad.
 * - USUARIO (dueño): solo RESUELTO o reabrir (ABIERTO), y no
 *   puede cambiar la severidad — el service lo hace cumplir.
 *
 * Al pasar a RESUELTO/CERRADO se registra fecha_cierre.
 * ══════════════════════════════════════════════════════
 */
export class ActualizarIncidenteDto {
  @ApiProperty({
    enum: ['ABIERTO', 'EN_REVISION', 'RESUELTO', 'CERRADO'],
    example: 'EN_REVISION',
  })
  @IsIn(['ABIERTO', 'EN_REVISION', 'RESUELTO', 'CERRADO'], {
    message:
      'estado solo acepta: ABIERTO, EN_REVISION, RESUELTO, CERRADO.',
  })
  estado: 'ABIERTO' | 'EN_REVISION' | 'RESUELTO' | 'CERRADO';

  @ApiPropertyOptional({
    enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'],
    description: 'Solo ADMIN/INSTITUCION',
  })
  @IsOptional()
  @IsIn(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'], {
    message: 'severidad solo acepta: BAJA, MEDIA, ALTA, CRITICA.',
  })
  severidad?: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
}
