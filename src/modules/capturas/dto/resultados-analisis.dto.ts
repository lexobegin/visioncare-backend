import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstimacionAutenticidad } from '../entities/billete-reconocido.entity';

/**
 * ══════════════════════════════════════════════════════
 * Contratos de resultado por tipo de análisis.
 *
 * Estas son las formas EXACTAS que devuelven los endpoints
 * de FastAPI (T10–15) y que el VisionIaClient (T4) espera.
 * El VisionService (T5) las persiste en su tabla destino.
 *
 * Convención: confianza siempre 0–1 (o null si no aplica).
 * ══════════════════════════════════════════════════════
 */

// ═══════════════ OCR (CU11) → lecturas_ocr ═══════════════

export class ResultadoOcrDto {
  @ApiProperty({
    example: 'SALIDA DE EMERGENCIA\nEmpuje la barra',
    description: 'Texto reconocido completo (puede ser multilínea)',
  })
  texto_extraido: string;

  @ApiPropertyOptional({ example: 'es', description: 'Idioma detectado' })
  idioma: string | null;

  @ApiPropertyOptional({ example: 0.92, minimum: 0, maximum: 1 })
  confianza: number | null;

  @ApiPropertyOptional({
    example: 'cartel',
    description:
      'Clasificación del texto (heurística de FastAPI): cartel, etiqueta, precio, menu, documento, otro',
  })
  tipo_documento: string | null;
}

// ═══════════ SENALES Y LUGARES (CU12) → senales_lugares ═══════════

export class ItemSenalDto {
  @ApiProperty({
    example: 'salida',
    description:
      "Tipo normalizado: 'senal_stop', 'semaforo', 'salida', 'bano', 'escaleras', 'peligro', 'cruce'…",
  })
  tipo_senal: string;

  @ApiPropertyOptional({
    example: 'SALIDA DE EMERGENCIA',
    description: 'Texto específico reconocido (OCR de la señal)',
  })
  nombre_reconocido: string | null;

  @ApiPropertyOptional({
    example: 'Señal de salida detectada mediante texto',
  })
  descripcion: string | null;

  @ApiPropertyOptional({ example: 0.88, minimum: 0, maximum: 1 })
  confianza: number | null;
}

export class ResultadoSenalesDto {
  @ApiProperty({ type: [ItemSenalDto] })
  senales: ItemSenalDto[];
}

// ═══════════ PRODUCTOS (CU13) → productos_reconocidos ═══════════

export class ItemProductoDto {
  @ApiProperty({
    example: 'Coca-Cola 500ml',
    description: 'Nombre del producto (OCR del empaque o clase COCO)',
  })
  nombre_producto: string | null;

  @ApiPropertyOptional({ example: 'Coca-Cola' })
  marca: string | null;

  @ApiPropertyOptional({
    example: 'bebida',
    description: "Categoría: bebida, fruta, snack, limpieza, higiene, otro",
  })
  categoria: string | null;

  @ApiPropertyOptional({ example: 'Botella detectada con texto del empaque' })
  descripcion: string | null;

  @ApiPropertyOptional({ example: 0.85, minimum: 0, maximum: 1 })
  confianza: number | null;
}

export class ResultadoProductosDto {
  @ApiProperty({ type: [ItemProductoDto] })
  productos: ItemProductoDto[];
}

// ═══════════ COLORES (CU14) → colores_reconocidos ═══════════

export class ResultadoColoresDto {
  @ApiProperty({
    example: 'azul',
    description: 'Color dominante en español',
  })
  color_principal: string;

  @ApiPropertyOptional({
    example: ['blanco', 'gris'],
    description: 'Colores secundarios significativos',
    type: [String],
  })
  colores_secundarios: string[] | null;

  @ApiPropertyOptional({ example: 0.9, minimum: 0, maximum: 1 })
  confianza: number | null;
}

// ═══════════ BILLETES (CU15/CU16) → billetes_reconocidos ═══════════

export class ResultadoBilleteDto {
  @ApiProperty({ example: 'BOB', description: "Moneda detectada ('BOB', 'USD'…)" })
  moneda: string | null;

  @ApiProperty({ example: '100', description: 'Denominación detectada' })
  denominacion: string | null;

  @ApiPropertyOptional({ example: 0.87, minimum: 0, maximum: 1 })
  confianza: number | null;

  @ApiProperty({
    enum: ['PROBABLEMENTE_AUTENTICO', 'PROBABLEMENTE_SOSPECHOSO', 'INDETERMINADO'],
    description:
      'Estimación VISUAL de autenticidad — NO constituye certificación (advertencia del modelo SQL)',
  })
  autenticidad_estimacion: EstimacionAutenticidad | null;

  @ApiPropertyOptional({
    example: 0.6,
    minimum: 0,
    maximum: 1,
    description: 'Confianza de la propia estimación de autenticidad',
  })
  confianza_autenticidad: number | null;

  @ApiPropertyOptional({
    example: 'Texto de denominación legible; patrones visuales consistentes',
  })
  observaciones: string | null;
}

// ═══════════ DESCRIPCIÓN (CU10) → descripciones_entorno ═══════════

export class ResultadoDescripcionDto {
  @ApiProperty({
    example:
      'Escena con 2 personas al frente, una a la izquierda; una señal a la derecha.',
    description: 'Descripción completa de la escena',
  })
  descripcion: string;

  @ApiProperty({
    example: 'Dos personas al frente y una señal a la derecha.',
    description: 'Versión corta lista para TTS',
  })
  resumen: string;

  @ApiPropertyOptional({ example: 0.8, minimum: 0, maximum: 1 })
  confianza: number | null;
}