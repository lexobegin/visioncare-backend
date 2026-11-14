import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /visioncoach/sesiones/:id/finalizar
 * Al COMPLETAR se dispara la adaptación de dificultad (CU31)
 * y la revisión de insignias (CU33).
 * ══════════════════════════════════════════════════════
 */
export class FinalizarSesionDto {
  @ApiProperty({
    enum: ['COMPLETADA', 'ABANDONADA'],
    example: 'COMPLETADA',
  })
  @IsIn(['COMPLETADA', 'ABANDONADA'], {
    message: 'estado_final solo acepta: COMPLETADA, ABANDONADA.',
  })
  estado_final: 'COMPLETADA' | 'ABANDONADA';
}
