import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /visioncoach/desafios/:id (CU31)
 * ══════════════════════════════════════════════════════
 */
export class ActualizarDesafioDto {
  @ApiProperty({
    enum: ['EN_CURSO', 'COMPLETADO', 'OMITIDO'],
    example: 'COMPLETADO',
  })
  @IsIn(['EN_CURSO', 'COMPLETADO', 'OMITIDO'], {
    message: 'estado solo acepta: EN_CURSO, COMPLETADO, OMITIDO.',
  })
  estado: 'EN_CURSO' | 'COMPLETADO' | 'OMITIDO';
}
