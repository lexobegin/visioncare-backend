import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Detección individual dentro de una captura */
export class DeteccionResponseDto {
  @ApiProperty({ example: 1 })
  id_deteccion: number;

  @ApiProperty({
    example: 'person',
    description: 'Etiqueta original del modelo (inglés)',
  })
  etiqueta: string;

  @ApiProperty({
    example: 'persona',
    description: 'Etiqueta traducida al español (para TTS)',
  })
  etiqueta_es: string;

  @ApiPropertyOptional({ example: 'persona', nullable: true })
  categoria?: string | null;

  @ApiProperty({ example: 0.94, minimum: 0, maximum: 1 })
  confianza: number;

  @ApiPropertyOptional({
    example: { x_min: 10.5, y_min: 20.1, x_max: 150.2, y_max: 300.9 },
    description: 'Posición del objeto en la imagen (bounding box)',
  })
  bbox?: {
    x_min: number | null;
    y_min: number | null;
    x_max: number | null;
    y_max: number | null;
  };

  @ApiPropertyOptional({ example: 'yolov8n', nullable: true })
  modelo_nombre?: string | null;

  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  fecha_deteccion: Date;
}

/** Captura con o sin detecciones según el endpoint */
export class CapturaResponseDto {
  @ApiProperty({ example: 1 })
  id_captura: number;

  @ApiProperty({ example: 1 })
  id_usuario: number;

  @ApiPropertyOptional({
    example: 'capturas/1/2026/09/uuid.jpg',
    nullable: true,
    description: 'Ruta del archivo en Cloudflare R2',
  })
  r2_key?: string | null;

  @ApiPropertyOptional({
    example: 'https://pub-xxx.r2.dev/capturas/1/2026/09/uuid.jpg',
    nullable: true,
    description: 'URL pública de la imagen (si R2_URL_PUBLICA está configurado)',
  })
  url_imagen?: string | null;

  @ApiProperty({ enum: ['IMAGEN', 'VIDEO', 'FOTOGRAMA'] })
  tipo_captura: string;

  @ApiProperty({ enum: ['CAMARA', 'GALERIA'] })
  origen: string;

  @ApiPropertyOptional({ example: -17.7833, nullable: true })
  latitud?: number | null;

  @ApiPropertyOptional({ example: -63.1821, nullable: true })
  longitud?: number | null;

  @ApiProperty({ example: '2026-09-15T14:30:00.000Z' })
  fecha_captura: Date;

  @ApiProperty({ example: true })
  procesada: boolean;

  @ApiProperty({ enum: ['PENDIENTE', 'PROCESANDO', 'PROCESADA', 'ERROR'] })
  estado: string;

  @ApiPropertyOptional({ type: [DeteccionResponseDto] })
  detecciones?: DeteccionResponseDto[];

  @ApiPropertyOptional({
    example: 'Se detectaron: 2 personas y 1 bicicleta.',
    description: 'Resumen listo para reproducir con TTS',
  })
  resumen_voz?: string | null;

  @ApiPropertyOptional({
    example: false,
    description:
      'Indica si el servicio de IA estuvo disponible durante el reconocimiento',
  })
  ia_disponible?: boolean;
}