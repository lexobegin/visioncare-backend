import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /sincronizacion/bajar (CU26)
 * Descarga los datos propios modificados desde
 * `ultima_fecha_sincronizacion` (o los últimos 7 días).
 * ══════════════════════════════════════════════════════
 */
export class BajarSincronizacionDto {
  @ApiProperty({
    example: 'android-pixel-7-abc123',
  })
  @IsString({ message: 'dispositivo_id debe ser texto.' })
  @MinLength(1, { message: 'dispositivo_id no puede estar vacío.' })
  @MaxLength(150, {
    message: 'dispositivo_id no puede superar 150 caracteres.',
  })
  dispositivo_id: string;

  @ApiPropertyOptional({
    example: '2026-11-05T10:30:00.000Z',
    description: 'Fecha del último pull (si falta: últimos 7 días)',
  })
  @IsOptional()
  @IsDateString({}, {
    message: 'ultima_fecha_sincronizacion debe ser fecha ISO 8601.',
  })
  ultima_fecha_sincronizacion?: string;
}
