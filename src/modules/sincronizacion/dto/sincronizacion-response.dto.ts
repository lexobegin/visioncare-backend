import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ══════════════════════════════════════════════════════
 * Contratos de respuesta del módulo sincronización (CU25–CU26).
 * ══════════════════════════════════════════════════════
 */

/** Resultado por cada cambio del lote (uno a uno) */
export class CambioResultadoDto {
  @ApiProperty({ example: 'a1b2c3d4-offline-001' })
  identificador_local: string;

  @ApiProperty({ example: 'NAVEGACION' })
  entidad: string;

  @ApiProperty({
    enum: ['SINCRONIZADO', 'ERROR', 'OMITIDO_DUPLICADO'],
    description:
      'OMITIDO_DUPLICADO: ya se había subido ese identificador_local con el mismo dispositivo',
  })
  estado: string;

  @ApiPropertyOptional({
    example: 42,
    nullable: true,
    description: 'ID en el servidor (si aplica)',
  })
  identificador_servidor?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Detalle si hubo error' })
  mensaje?: string | null;
}

/** POST /sincronizacion/subir — resumen del lote */
export class SubirResultadoDto {
  @ApiProperty({ example: 'android-pixel-7-abc123' })
  dispositivo_id: string;

  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 8 })
  sincronizados: number;

  @ApiProperty({ example: 1 })
  omitidos_duplicados: number;

  @ApiProperty({ example: 1 })
  errores: number;

  @ApiProperty({ type: [CambioResultadoDto] })
  resultados: CambioResultadoDto[];
}

/** Punto GPS dentro de una navegación descargada */
export class PuntoOfflineDto {
  @ApiProperty({ example: 1 })
  id_punto: number;

  @ApiProperty({ example: 1 })
  orden: number;

  @ApiProperty({ example: -17.7835 })
  latitud: number;

  @ApiProperty({ example: -63.1825 })
  longitud: number;

  @ApiPropertyOptional({ nullable: true })
  instruccion?: string | null;

  @ApiPropertyOptional({ nullable: true })
  referencia_entorno?: string | null;
}

/** Navegación descargada (cache del móvil) */
export class NavegacionOfflineDto {
  @ApiProperty({ example: 15 })
  id_navegacion: number;

  @ApiPropertyOptional({ example: -17.7833, nullable: true })
  origen_latitud?: number | null;

  @ApiPropertyOptional({ example: -63.1821, nullable: true })
  origen_longitud?: number | null;

  @ApiPropertyOptional({ example: -17.7901, nullable: true })
  destino_latitud?: number | null;

  @ApiPropertyOptional({ example: -63.1901, nullable: true })
  destino_longitud?: number | null;

  @ApiPropertyOptional({ nullable: true })
  destino_descripcion?: string | null;

  @ApiProperty({ example: 'ASISTIDA' })
  modo: string;

  @ApiProperty({ example: 'COMPLETADA' })
  estado: string;

  @ApiProperty({ example: '2026-11-12T15:00:00.000Z' })
  fecha_inicio: Date;

  @ApiPropertyOptional({ nullable: true })
  fecha_fin?: Date | null;

  @ApiProperty({ type: [PuntoOfflineDto] })
  puntos: PuntoOfflineDto[];
}

/** Actividad del historial descargada */
export class HistorialOfflineDto {
  @ApiProperty({ example: 981 })
  id_historial: number;

  @ApiProperty({ example: 'NAVEGACION_FINALIZADA' })
  tipo_actividad: string;

  @ApiPropertyOptional({ nullable: true })
  referencia_id?: number | null;

  @ApiPropertyOptional({ nullable: true })
  descripcion?: string | null;

  @ApiProperty({ example: '2026-11-12T15:10:00.000Z' })
  fecha_actividad: Date;
}

/** POST /sincronizacion/bajar — datos para llenar la cache */
export class BajarResultadoDto {
  @ApiProperty({
    example: '2026-11-12T15:30:00.000Z',
    description:
      'Guardar esta fecha y enviarla como ultima_fecha_sincronizacion en el próximo pull',
  })
  fecha_servidor: Date;

  @ApiProperty({
    example: '2026-11-05T10:30:00.000Z',
    description: 'Fecha desde la que se descargó',
  })
  desde: Date;

  @ApiProperty({ type: [NavegacionOfflineDto] })
  navegaciones: NavegacionOfflineDto[];

  @ApiProperty({ type: [HistorialOfflineDto] })
  historial: HistorialOfflineDto[];
}

/** Fila de la bitácora GET /sincronizacion */
export class SincronizacionResponseDto {
  @ApiProperty({ example: 1 })
  id_sincronizacion: number;

  @ApiProperty({ example: 7 })
  id_usuario: number;

  @ApiProperty({ example: 'android-pixel-7-abc123' })
  dispositivo_id: string;

  @ApiProperty({ enum: ['SUBIDA', 'BAJADA', 'BIDIRECCIONAL'] })
  direccion: string;

  @ApiPropertyOptional({ example: 'NAVEGACION', nullable: true })
  entidad?: string | null;

  @ApiPropertyOptional({ nullable: true })
  identificador_local?: string | null;

  @ApiPropertyOptional({ nullable: true })
  identificador_servidor?: number | null;

  @ApiProperty({ example: false })
  conflicto_detectado: boolean;

  @ApiPropertyOptional({ nullable: true })
  resolucion_conflicto?: string | null;

  @ApiProperty({ enum: ['PENDIENTE', 'PROCESANDO', 'SINCRONIZADO', 'ERROR', 'CONFLICTO'] })
  estado: string;

  @ApiProperty({ example: '2026-11-12T15:30:00.000Z' })
  fecha_sincronizacion: Date;
}
