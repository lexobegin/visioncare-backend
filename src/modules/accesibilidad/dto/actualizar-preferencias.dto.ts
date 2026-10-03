import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: PATCH /accesibilidad/me  (CU03 — Configurar accesibilidad)
 * Todos los campos son opcionales (actualización parcial).
 * Los rangos replican los CHECK de la tabla en la BD.
 * ══════════════════════════════════════════════════════
 */
export class ActualizarPreferenciasDto {
  @ApiPropertyOptional({ example: true, description: 'Activar/desactivar el feedback por voz' })
  @IsOptional()
  @IsBoolean({ message: 'voz_habilitada debe ser true o false.' })
  voz_habilitada?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 90 })
  @IsOptional()
  @IsNumber({}, { message: 'volumen_voz debe ser un número.' })
  @Min(0, { message: 'volumen_voz debe estar entre 0 y 100.' })
  @Max(100, { message: 'volumen_voz debe estar entre 0 y 100.' })
  volumen_voz?: number;

  @ApiPropertyOptional({
    minimum: 0.5,
    maximum: 3,
    example: 1.2,
    description: 'Velocidad de la voz sintetizada',
  })
  @IsOptional()
  @IsNumber({}, { message: 'velocidad_voz debe ser un número.' })
  @Min(0.5, { message: 'velocidad_voz debe estar entre 0.5 y 3.0.' })
  @Max(3, { message: 'velocidad_voz debe estar entre 0.5 y 3.0.' })
  velocidad_voz?: number;

  @ApiPropertyOptional({ example: true, description: 'Alertas sonoras del sistema' })
  @IsOptional()
  @IsBoolean({ message: 'alertas_sonoras debe ser true o false.' })
  alertas_sonoras?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Alertas por vibración' })
  @IsOptional()
  @IsBoolean({ message: 'vibracion_habilitada debe ser true o false.' })
  vibracion_habilitada?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 70 })
  @IsOptional()
  @IsNumber({}, { message: 'intensidad_vibracion debe ser un número.' })
  @Min(0, { message: 'intensidad_vibracion debe estar entre 0 y 100.' })
  @Max(100, { message: 'intensidad_vibracion debe estar entre 0 y 100.' })
  intensidad_vibracion?: number;

  @ApiPropertyOptional({ example: true, description: 'Confirmar acciones mediante voz' })
  @IsOptional()
  @IsBoolean({ message: 'confirmaciones_por_voz debe ser true o false.' })
  confirmaciones_por_voz?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Modo de ahorro de batería' })
  @IsOptional()
  @IsBoolean({ message: 'modo_bajo_consumo debe ser true o false.' })
  modo_bajo_consumo?: boolean;
}