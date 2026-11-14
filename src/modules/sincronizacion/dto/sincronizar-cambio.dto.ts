import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Entidades que acepta la subida offline (CU25):
 *  - NAVEGACION          → crea navegación + puntos (payload completo)
 *  - PUNTO_NAVEGACION    → agrega un punto a una navegación ya creada
 *  - HISTORIAL_ACTIVIDAD → registra una actividad offline
 */
export const ENTIDADES_SYNC = [
  'NAVEGACION',
  'PUNTO_NAVEGACION',
  'HISTORIAL_ACTIVIDAD',
] as const;

export type EntidadSync = (typeof ENTIDADES_SYNC)[number];

/**
 * ══════════════════════════════════════════════════════
 * DTO: un cambio offline dentro del lote de subida.
 *
 * `identificador_local` es el ID que la app generó offline
 * (UUID). Sirve para idempotencia: si ya se sincronizó con el
 * mismo dispositivo, se omite y se devuelve el ID de servidor.
 * `payload` se valida por entidad en el service (errores por
 * cambio, no por lote).
 * ══════════════════════════════════════════════════════
 */
export class SincronizarCambioDto {
  @ApiProperty({ enum: ENTIDADES_SYNC, example: 'NAVEGACION' })
  @IsIn(ENTIDADES_SYNC as unknown as string[], {
    message: `entidad solo acepta: ${ENTIDADES_SYNC.join(', ')}.`,
  })
  entidad: EntidadSync;

  @ApiProperty({
    example: 'a1b2c3d4-offline-001',
    description: 'ID local del registro (idempotencia)',
  })
  @IsString({ message: 'identificador_local debe ser texto.' })
  @MaxLength(150, {
    message: 'identificador_local no puede superar 150 caracteres.',
  })
  identificador_local: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Versión local del registro (si la app versiona)',
  })
  @IsOptional()
  @IsInt({ message: 'version_local debe ser un número entero.' })
  @Min(0, { message: 'version_local no puede ser negativa.' })
  version_local?: number;

  @ApiProperty({
    description:
      'Contenido del cambio (estructura según entidad — ver README)',
  })
  @IsObject({ message: 'payload debe ser un objeto JSON.' })
  payload: Record<string, unknown>;
}
