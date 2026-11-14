import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /navegaciones/:id/finalizar (CU24)
 * Registra fecha_fin y cierra la navegación.
 * ══════════════════════════════════════════════════════
 */
export class FinalizarNavegacionDto {
  @ApiProperty({
    enum: ['COMPLETADA', 'CANCELADA', 'ERROR'],
    example: 'COMPLETADA',
  })
  @IsIn(['COMPLETADA', 'CANCELADA', 'ERROR'], {
    message: 'estado_final solo acepta: COMPLETADA, CANCELADA, ERROR.',
  })
  estado_final: 'COMPLETADA' | 'CANCELADA' | 'ERROR';
}
