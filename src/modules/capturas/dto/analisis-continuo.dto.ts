import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import type {
  CanalAlerta,
  NivelAlerta,
} from '../../alertas/entities/alerta.entity';

/**
 * ══════════════════════════════════════════════════════
 * MODO CONTINUO — contrato del "asistente manos libres"
 * (dispositivo en el pecho, cámara hacia el frente).
 *
 * FLUJO (cada N segundos, decidido por la app según CU03):
 *   📱 fotograma → POST /capturas/analizar (multipart)
 *   → backend: YOLO + priorización (HU17) → respuesta:
 *
 *   SILENCIO → misma escena conocida        → móvil NO habla
 *   INFO     → novedad leve (señal nueva…)   → narración breve
 *   ALERTA   → 🚨 riesgo (obstáculo/vehículo)→ voz FORZADA +
 *              vibración; se PERSISTE alerta (y detección);
 *              la imagen NUNCA se persiste (efímero por diseño)
 *
 * `siguiente_analisis_ms` regula el ritmo (el backend manda):
 *   3000 normal | 6000 modo bajo consumo | 2000 tras ALERTA
 *   (seguimiento rápido de la situación detectada)
 *
 * Estado de "novedad" por usuario: en memoria del proceso
 * (PriorizacionService, T6). Limitación documentada: con
 * múltiples instancias de backend → mover a Redis (S3+).
 * ══════════════════════════════════════════════════════
 */

/** Nivel de novedad de la escena (decisión HU17) */
export type NivelNovedad = 'SILENCIO' | 'INFO' | 'ALERTA';

/**
 * Campos del formulario multipart (además del fotograma).
 * El GPS permite contextualizar alertas (Sprint 3: ayuda).
 */
export class AnalisisContinuoDto {
  @ApiPropertyOptional({ example: -17.7833, minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'latitud debe ser un número.' })
  @Min(-90, { message: 'latitud debe estar entre -90 y 90.' })
  @Max(90, { message: 'latitud debe estar entre -90 y 90.' })
  latitud?: number;

  @ApiPropertyOptional({ example: -63.1821, minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'longitud debe ser un número.' })
  @Min(-180, { message: 'longitud debe estar entre -180 y 180.' })
  @Max(180, { message: 'longitud debe estar entre -180 y 180.' })
  longitud?: number;

  @ApiPropertyOptional({
    example: 12.5,
    description: 'Precisión del fix GPS en metros (informativo)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'precision_gps debe ser un número.' })
  @Min(0, { message: 'precision_gps no puede ser negativo.' })
  precision_gps?: number;

  @ApiPropertyOptional({
    example: 640,
    description: 'Ancho en px del fotograma (para % de bbox en HU17)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'ancho debe ser un número.' })
  @Min(1, { message: 'ancho debe ser positivo.' })
  ancho?: number;

  @ApiPropertyOptional({
    example: 480,
    description: 'Alto en px del fotograma',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'alto debe ser un número.' })
  @Min(1, { message: 'alto debe ser positivo.' })
  alto?: number;

  @ApiPropertyOptional({
    default: 'false',
    description: "true = preferencia CU03 'modo_bajo_consumo' del usuario",
  })
  @IsOptional()
  bajo_consumo?: string; // multipart llega como string; se compara con 'true'

  @ApiPropertyOptional({
    enum: ['OCR'],
    description:
      'T19 — análisis del fotograma. Solo "OCR" está permitido en ' +
      'modo continuo (LECTURA CONTINUA de texto: narrar solo texto ' +
      'nuevo). Default: OBJETOS (YOLO + priorización HU17).',
  })
  @IsOptional()
  @IsIn(['OCR'], {
    message: 'En modo continuo, tipo_analisis solo acepta: OCR.',
  })
  tipo_analisis?: 'OCR';
}

/** Alerta emitida (solo presente cuando nivel_novedad = ALERTA) */
export class AlertaEmitidaDto {
  @ApiProperty({ example: 1 })
  id_alerta: number;

  @ApiProperty({
    example: 'OBSTACULO',
    description:
      'OBSTACULO | VEHICULO_CERCA | PERSONA_CERCA | SENAL_IMPORTANTE | SISTEMA',
  })
  tipo_alerta: string;

  @ApiProperty({ enum: ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'], example: 'CRITICO' })
  nivel: NivelAlerta;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  prioridad: number;

  @ApiProperty({
    enum: ['VOZ', 'SONIDO', 'VIBRACION', 'VOZ_VIBRACION', 'MULTICANAL'],
    description: 'La app ejecuta TTS/vibración/sonido según este canal + CU03',
  })
  canal: CanalAlerta;

  @ApiProperty({
    example: 'Obstáculo adelante a un metro.',
    description: 'Mensaje ya en español, listo para TTS',
  })
  mensaje: string;
}

/** Respuesta del endpoint POST /capturas/analizar */
export class AnalisisContinuoResponseDto {
  @ApiProperty({
    enum: ['SILENCIO', 'INFO', 'ALERTA'],
    description:
      'SILENCIO: no narrar (escena conocida) · INFO: narración breve · ALERTA: voz forzada + vibración',
  })
  nivel_novedad: NivelNovedad;

  @ApiProperty({
    example: 'Señal de salida a tu derecha.',
    nullable: true,
    description: 'Texto para TTS (null en SILENCIO — la app no habla)',
  })
  mensaje_voz: string | null;

  @ApiPropertyOptional({
    type: AlertaEmitidaDto,
    description: 'Solo cuando nivel_novedad = ALERTA (persistida en BD)',
  })
  alerta?: AlertaEmitidaDto;

  @ApiProperty({
    example: { duracion_ms: 240, detecciones: 3, siguiente_analisis_ms: 3000 },
    description: 'Metadatos técnicos del ciclo de análisis',
  })
  meta: {
    duracion_ms: number;
    detecciones: number;
    siguiente_analisis_ms: number;
  };
}