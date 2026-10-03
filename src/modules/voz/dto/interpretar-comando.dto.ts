import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /voz/interpretar  (CU06)
 * La app móvil envía el texto transcrito por el STT del
 * dispositivo y, opcionalmente, la confianza del STT.
 *
 * confianza_final = confianza_intención × confianza_stt
 * (si se envía confianza_stt; refleja las 2 etapas)
 * ══════════════════════════════════════════════════════
 */
export class InterpretarComandoDto {
  @ApiProperty({
    example: '¿Qué ves delante de mí?',
    description: 'Texto transcrito por el reconocimiento de voz (STT)',
    maxLength: 500,
  })
  @IsString({ message: 'comando debe ser texto.' })
  @MinLength(1, { message: 'comando no puede estar vacío.' })
  @MaxLength(500, { message: 'comando no puede superar 500 caracteres.' })
  comando: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 1,
    example: 0.92,
    description:
      'Confianza del STT del dispositivo (0–1). Si se envía, se ' +
      'combina con la confianza de la intención detectada.',
  })
  @IsOptional()
  @IsNumber({}, { message: 'confianza_stt debe ser un número.' })
  @Min(0, { message: 'confianza_stt debe estar entre 0 y 1.' })
  @Max(1, { message: 'confianza_stt debe estar entre 0 y 1.' })
  confianza_stt?: number;
}