import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contratos de respuesta del módulo visioncoach (CU27–CU33).
 * `mensaje_voz` en cada acción, listo para TTS en el móvil.
 * ══════════════════════════════════════════════════════
 */

export class CategoriaResponseDto {
  @ApiProperty({ example: 1 })
  id_categoria: number;

  @ApiProperty({ example: 'PERCEPCION' })
  nombre: string;

  @ApiPropertyOptional({ nullable: true })
  descripcion?: string | null;
}

export class EjercicioResponseDto {
  @ApiProperty({ example: 3 })
  id_ejercicio: number;

  @ApiProperty({ example: 1 })
  id_categoria: number;

  @ApiPropertyOptional({
    example: 'PERCEPCION',
    description: 'Nombre de la categoría (para la app)',
  })
  categoria_nombre?: string | null;

  @ApiProperty({ example: 'Identificar cruces seguros' })
  nombre: string;

  @ApiProperty({ example: 'Escucha la descripción y elige el cruce seguro.' })
  descripcion: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 5 })
  dificultad: number;

  @ApiProperty({ example: 10 })
  puntos_base: number;

  @ApiPropertyOptional({ example: 120, nullable: true })
  duracion_estimada_segundos?: number | null;
}

export class ResultadoResponseDto {
  @ApiProperty({ example: 1 })
  id_resultado: number;

  @ApiProperty({ example: 1 })
  id_sesion: number;

  @ApiProperty({ example: 3 })
  id_ejercicio: number;

  @ApiPropertyOptional({ nullable: true })
  respuesta?: string | null;

  @ApiProperty({ example: true })
  correcto: boolean | null;

  @ApiProperty({ example: 10 })
  puntuacion: number;

  @ApiPropertyOptional({ example: 34, nullable: true })
  tiempo_segundos?: number | null;

  @ApiProperty({ example: '2026-11-12T15:05:00.000Z' })
  fecha_resultado: Date;
}

export class SesionResponseDto {
  @ApiProperty({ example: 1 })
  id_sesion: number;

  @ApiProperty({ example: 7 })
  id_usuario: number;

  @ApiProperty({ example: '2026-11-12T15:00:00.000Z' })
  fecha_inicio: Date;

  @ApiPropertyOptional({ nullable: true })
  fecha_fin?: Date | null;

  @ApiProperty({ example: 30 })
  puntos_obtenidos: number;

  @ApiProperty({ enum: ['INICIADA', 'COMPLETADA', 'ABANDONADA'] })
  estado: string;

  @ApiPropertyOptional({ type: [ResultadoResponseDto] })
  resultados?: ResultadoResponseDto[];

  @ApiPropertyOptional({
    example: 'Sesión de entrenamiento iniciada. ¡Éxitos!',
    description: 'Texto listo para TTS',
  })
  mensaje_voz?: string | null;
}

export class ProgresoResponseDto {
  @ApiProperty({ example: 7 })
  id_usuario: number;

  @ApiProperty({ example: 2 })
  nivel: number;

  @ApiProperty({ example: 140 })
  puntos_totales: number;

  @ApiProperty({ example: 3 })
  racha_actual: number;

  @ApiProperty({ example: 6 })
  mejor_racha: number;

  @ApiProperty({ example: 12 })
  ejercicios_completados: number;

  @ApiProperty({ example: 2, description: 'Insignias obtenidas' })
  total_insignias: number;
}

export class DesafioResponseDto {
  @ApiProperty({ example: 1 })
  id_desafio: number;

  @ApiProperty({ example: 3 })
  id_ejercicio: number;

  @ApiPropertyOptional({
    example: 'Identificar cruces seguros',
    description: 'Nombre del ejercicio (para la app)',
  })
  ejercicio_nombre?: string | null;

  @ApiProperty({ example: 3, minimum: 1, maximum: 5 })
  dificultad_asignada: number;

  @ApiPropertyOptional({
    example: 'Rendimiento alto en la sesión #12',
    nullable: true,
  })
  motivo_adaptacion?: string | null;

  @ApiProperty({ enum: ['ASIGNADO', 'EN_CURSO', 'COMPLETADO', 'OMITIDO'] })
  estado: string;

  @ApiProperty({ example: '2026-11-12T15:10:00.000Z' })
  fecha_asignacion: Date;

  @ApiPropertyOptional({ nullable: true })
  fecha_completado?: Date | null;
}

export class InsigniaResponseDto {
  @ApiProperty({ example: 1 })
  id_insignia: number;

  @ApiProperty({ example: 'RACHA_5' })
  nombre: string;

  @ApiProperty({ example: 'Lograste una racha de 5 aciertos seguidos.' })
  descripcion: string;

  @ApiPropertyOptional({ nullable: true })
  condicion?: string | null;

  @ApiPropertyOptional({
    example: '2026-11-12T15:06:00.000Z',
    nullable: true,
    description: 'Solo en /insignias/mias: cuándo la obtuviste',
  })
  fecha_obtencion?: Date | null;
}

/** POST resultados — respuesta compuesta para el móvil */
export class ResultadoRegistradoDto {
  @ApiProperty({ type: ResultadoResponseDto })
  resultado: ResultadoResponseDto;

  @ApiProperty({ type: ProgresoResponseDto })
  progreso: ProgresoResponseDto;

  @ApiPropertyOptional({
    type: [String],
    example: ['RACHA_5'],
    description: 'Insignias recién obtenidas (si hubo)',
  })
  insignias_nuevas?: string[];

  @ApiProperty({
    example: '¡Correcto! +10 puntos. Llevas una racha de 3.',
    description: 'Texto listo para TTS',
  })
  mensaje_voz: string;
}

/** PATCH finalizar — respuesta compuesta para el móvil */
export class SesionFinalizadaDto {
  @ApiProperty({ type: SesionResponseDto })
  sesion: SesionResponseDto;

  @ApiProperty({ type: ProgresoResponseDto })
  progreso: ProgresoResponseDto;

  @ApiPropertyOptional({
    type: DesafioResponseDto,
    nullable: true,
    description: 'Desafío adaptativo asignado según el rendimiento (CU31)',
  })
  desafio_asignado?: DesafioResponseDto | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['MIL_PUNTOS'],
    description: 'Insignias recién obtenidas (si hubo)',
  })
  insignias_nuevas?: string[];

  @ApiProperty({
    example: 'Sesión completada. Obtuviste 30 puntos.',
    description: 'Texto listo para TTS',
  })
  mensaje_voz: string;
}
