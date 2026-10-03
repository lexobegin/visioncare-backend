import { ApiProperty } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta del módulo accesibilidad.
 * La app móvil consume esto para configurar TTS, STT,
 * vibración y sonidos localmente (CU03).
 * ══════════════════════════════════════════════════════
 */
export class PreferenciasResponseDto {
  @ApiProperty({ example: 1 })
  id_preferencia: number;

  @ApiProperty({ example: 1 })
  id_usuario: number;

  @ApiProperty({ example: true })
  voz_habilitada: boolean;

  @ApiProperty({ example: 80 })
  volumen_voz: number;

  @ApiProperty({ example: 1.0 })
  velocidad_voz: number;

  @ApiProperty({ example: true })
  alertas_sonoras: boolean;

  @ApiProperty({ example: true })
  vibracion_habilitada: boolean;

  @ApiProperty({ example: 80 })
  intensidad_vibracion: number;

  @ApiProperty({ example: true })
  confirmaciones_por_voz: boolean;

  @ApiProperty({ example: false })
  modo_bajo_consumo: boolean;
}