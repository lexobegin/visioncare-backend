import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * ══════════════════════════════════════════════════════
 * Query del listado de historial:
 *
 *   GET /historial?consolidado=true&page=1&limit=20
 *                &tipo_actividad=SESION_INICIADA
 *                &fecha_desde=2026-09-01
 *                &fecha_hasta=2026-09-30
 *                &buscar=login
 *
 * consolidado=true (default) fusiona: eventos + comandos de
 * voz + capturas en un solo feed ordenado por fecha.
 * ══════════════════════════════════════════════════════
 */
export class HistorialQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Filtrar por tipo de actividad. En consolidado también acepta ' +
      'COMANDO_VOZ y CAPTURA_ENTORNO.',
    example: 'SESION_INICIADA',
  })
  @IsOptional()
  @IsString({ message: 'tipo_actividad debe ser texto.' })
  @MaxLength(50, { message: 'tipo_actividad no puede superar 50 caracteres.' })
  tipo_actividad?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'fecha_desde debe ser una fecha ISO (YYYY-MM-DD).' })
  fecha_desde?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsISO8601({}, { message: 'fecha_hasta debe ser una fecha ISO (YYYY-MM-DD).' })
  fecha_hasta?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'true = fusiona voz + capturas + eventos (CU37 completo)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'consolidado debe ser true o false.' })
  consolidado?: boolean;
}