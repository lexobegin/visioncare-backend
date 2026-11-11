import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /alertas/atender-lote
 *
 * El móvil recupera N pendientes, las reproduce (voz+vibración)
 * y marca todas de una vez. Máx. 100 por lote (protección).
 * ══════════════════════════════════════════════════════
 */
export class AtenderLoteDto {
  @ApiProperty({
    type: [Number],
    example: [12, 13, 14],
    description: 'IDs de las alertas reproducidas por la app',
  })
  @IsArray({ message: 'ids debe ser un arreglo.' })
  @ArrayMinSize(1, { message: 'ids debe contener al menos 1 elemento.' })
  @ArrayMaxSize(100, { message: 'ids no puede superar 100 elementos por lote.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'cada id debe ser un número entero.' })
  @Min(1, { each: true, message: 'cada id debe ser mayor o igual a 1.' })
  ids: number[];
}