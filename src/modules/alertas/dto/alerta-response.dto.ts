import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contrato de respuesta del módulo alertas.
 * `mensaje` viaja listo para TTS (construido por el
 * PriorizacionService en español natural).
 * ══════════════════════════════════════════════════════
 */
export class AlertaResponseDto {
  @ApiProperty({ example: 1 })
  id_alerta: number;

  @ApiProperty({ example: 4 })
  id_usuario: number;

  @ApiPropertyOptional({
    example: 15,
    nullable: true,
    description: 'Detección que originó la alerta (trazabilidad)',
  })
  id_deteccion?: number | null;

  @ApiProperty({
    example: 'OBSTACULO',
    description:
      'OBSTACULO | VEHICULO_CERCA | PERSONA_CERCA | SENAL_IMPORTANTE | AYUDA_SOLICITADA | SISTEMA',
  })
  tipo_alerta: string;

  @ApiProperty({ enum: ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'], example: 'CRITICO' })
  nivel: string;

  @ApiProperty({
    example: 'Atención: un auto delante de ti.',
    description: 'Texto listo para TTS',
  })
  mensaje: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  prioridad: number;

  @ApiProperty({
    enum: ['VOZ', 'SONIDO', 'VIBRACION', 'VOZ_VIBRACION', 'MULTICANAL'],
    description: 'La app ejecuta TTS/vibración/sonido según canal + CU03',
  })
  canal: string;

  @ApiProperty({ example: false })
  atendida: boolean;

  @ApiProperty({ example: '2026-10-12T14:30:00.000Z' })
  fecha_generacion: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  fecha_atencion?: Date | null;
}

/** Item del resumen por tipo (GET /alertas/resumen) */
export class AlertaPorTipoDto {
  @ApiProperty({ example: 'OBSTACULO' })
  tipo_alerta: string;

  @ApiProperty({ example: 7 })
  total: number;
}

/** Respuesta del resumen (dashboard web + móvil) */
export class ResumenAlertasDto {
  @ApiProperty({
    example: { BAJO: 2, MEDIO: 5, ALTO: 3, CRITICO: 1 },
    description: 'Conteo por nivel',
  })
  por_nivel: Record<string, number>;

  @ApiProperty({ type: [AlertaPorTipoDto] })
  por_tipo: AlertaPorTipoDto[];

  @ApiProperty({ example: 3, description: 'Alertas sin atender ahora mismo' })
  total_pendientes: number;

  @ApiProperty({ example: 6, description: 'Alertas generadas hoy' })
  total_hoy: number;
}