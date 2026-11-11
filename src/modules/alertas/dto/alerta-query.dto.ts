import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * ══════════════════════════════════════════════════════
 * Query del historial de alertas:
 *   GET /alertas?nivel=CRITICO&tipo_alerta=OBSTACULO&atendida=false
 * ══════════════════════════════════════════════════════
 */
export class AlertaQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'],
    description: 'Filtrar por nivel de riesgo',
  })
  @IsOptional()
  @IsIn(['BAJO', 'MEDIO', 'ALTO', 'CRITICO'], {
    message: 'nivel solo acepta: BAJO, MEDIO, ALTO, CRITICO.',
  })
  nivel?: string;

  @ApiPropertyOptional({
    example: 'OBSTACULO',
    description:
      "Filtrar por tipo: OBSTACULO, VEHICULO_CERCA, PERSONA_CERCA, SENAL_IMPORTANTE, AYUDA_SOLICITADA, SISTEMA",
  })
  @IsOptional()
  @IsString({ message: 'tipo_alerta debe ser texto.' })
  @MaxLength(50, { message: 'tipo_alerta no puede superar 50 caracteres.' })
  tipo_alerta?: string;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Filtrar por estado de atención (si se omite: todas)',
  })
  @IsOptional()
  @IsIn(['true', 'false'], {
    message: 'atendida solo acepta: true, false.',
  })
  atendida?: 'true' | 'false';
}