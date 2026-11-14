import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { SincronizarCambioDto } from './sincronizar-cambio.dto';

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /sincronizacion/subir (CU25)
 * Lote de cambios offline (máximo 100 por request). El
 * resultado es por cambio: los errores no abortan el lote.
 * ══════════════════════════════════════════════════════
 */
export class SubirSincronizacionDto {
  @ApiProperty({
    example: 'android-pixel-7-abc123',
    description: 'ID del dispositivo que sincroniza',
  })
  @IsString({ message: 'dispositivo_id debe ser texto.' })
  @MinLength(1, { message: 'dispositivo_id no puede estar vacío.' })
  @MaxLength(150, {
    message: 'dispositivo_id no puede superar 150 caracteres.',
  })
  dispositivo_id: string;

  @ApiProperty({
    type: [SincronizarCambioDto],
    description: 'Cambios offline pendientes (hasta 100)',
  })
  @IsArray({ message: 'cambios debe ser un arreglo.' })
  @ArrayNotEmpty({ message: 'cambios no puede estar vacío.' })
  @ArrayMaxSize(100, {
    message: 'Envía como máximo 100 cambios por request.',
  })
  @ValidateNested({ each: true })
  @Type(() => SincronizarCambioDto)
  cambios: SincronizarCambioDto[];
}
