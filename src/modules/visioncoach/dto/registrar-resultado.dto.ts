import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /visioncoach/sesiones/:id/resultados (CU29)
 *
 * La puntuación NO viaja desde la app: el servidor calcula
 * `puntos_base` del ejercicio si `correcto` es true (anti-trampa).
 * ══════════════════════════════════════════════════════
 */
export class RegistrarResultadoDto {
  @ApiProperty({ example: 3, description: 'Ejercicio resuelto' })
  @Type(() => Number)
  @IsInt({ message: 'id_ejercicio debe ser un número entero.' })
  @Min(1, { message: 'id_ejercicio debe ser mayor o igual a 1.' })
  id_ejercicio: number;

  @ApiProperty({ example: true, description: '¿Resolvió correctamente?' })
  @IsBoolean({ message: 'correcto debe ser verdadero o falso.' })
  correcto: boolean;

  @ApiPropertyOptional({
    example: 'Semáforo con banco a la derecha',
    description: 'Respuesta dada por el usuario (voz o texto)',
  })
  @IsOptional()
  @IsString({ message: 'respuesta debe ser texto.' })
  @MaxLength(1000, { message: 'respuesta no puede superar 1000 caracteres.' })
  respuesta?: string;

  @ApiPropertyOptional({ example: 34, description: 'Segundos que tardó' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'tiempo_segundos debe ser un número entero.' })
  @Min(0, { message: 'tiempo_segundos no puede ser negativo.' })
  tiempo_segundos?: number;

  @ApiPropertyOptional({ example: 'Dudó entre dos opciones' })
  @IsOptional()
  @IsString({ message: 'observaciones debe ser texto.' })
  @MaxLength(1000, {
    message: 'observaciones no puede superar 1000 caracteres.',
  })
  observaciones?: string;
}
