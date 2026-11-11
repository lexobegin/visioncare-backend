/**
 * ══════════════════════════════════════════════════════
 * Tipos de análisis visual — columna vertebral del Sprint 2.
 *
 * Cada tipo mapea:
 *   - casoUso:   CU del backlog que implementa
 *   - endpointIA: ruta en FastAPI (servicio IA)
 *   - persistencia: tabla destino (null = efímero/solo objetos)
 *   - modo:      PUNTUAL (usuario lo pide) | CONTINUO (narración)
 *
 * Uso en el dispatch:
 *   const cfg = CATALOGO_TIPOS[tipo];
 *   await this.iaClient[cfg.metodoClient](...);
 * ══════════════════════════════════════════════════════
 */

export enum TipoAnalisis {
  /** CU08 — Reconocimiento básico YOLO (Sprint 1) */
  OBJETOS = 'OBJETOS',
  /** CU11 — Lectura de textos (carteles, etiquetas, menús) */
  OCR = 'OCR',
  /** CU12 — Señales, salidas, baños, escaleras, cruces */
  SENALES = 'SENALES',
  /** CU13 — Productos y envases comerciales */
  PRODUCTOS = 'PRODUCTOS',
  /** CU14 — Color dominante de prendas/objetos */
  COLORES = 'COLORES',
  /** CU15+CU16 — Billetes: moneda, denominación + autenticidad */
  BILLETES = 'BILLETES',
  /** CU10 — Descripción general de la escena */
  DESCRIPCION = 'DESCRIPCION',
}

/** Metadatos de dispatch por tipo */
export interface ConfigTipoAnalisis {
  casoUso: string;
  endpointIA: string;
  /** Método correspondiente en VisionIaClient (T4) */
  metodoClient: string;
  /** Tabla donde persiste el resultado (T5) — null = no persiste */
  tablaPersistencia:
    | 'detecciones_ia'
    | 'lecturas_ocr'
    | 'senales_lugares'
    | 'productos_reconocidos'
    | 'colores_reconocidos'
    | 'billetes_reconocidos'
    | 'descripciones_entorno';
  /** Disponible en el Modo Continuo (narración automática) */
  enModoContinuo: boolean;
  descripcion: string;
}

export const CATALOGO_TIPOS: Record<TipoAnalisis, ConfigTipoAnalisis> = {
  [TipoAnalisis.OBJETOS]: {
    casoUso: 'CU08',
    endpointIA: '/detecciones/objetos',
    metodoClient: 'detectarObjetos',
    tablaPersistencia: 'detecciones_ia',
    enModoContinuo: true, // base del continuo (obstáculos HU09)
    descripcion: 'Objetos y personas del entorno (YOLO)',
  },
  [TipoAnalisis.OCR]: {
    casoUso: 'CU11',
    endpointIA: '/ocr/leer',
    metodoClient: 'leerTexto',
    tablaPersistencia: 'lecturas_ocr',
    enModoContinuo: false, // puntual: señalar el texto
    descripcion: 'Lectura de textos con OCR',
  },
  [TipoAnalisis.SENALES]: {
    casoUso: 'CU12',
    endpointIA: '/senales/reconocer',
    metodoClient: 'reconocerSenales',
    tablaPersistencia: 'senales_lugares',
    enModoContinuo: true, // narrar señales nuevas al caminar
    descripcion: 'Señales, salidas, baños y lugares clave',
  },
  [TipoAnalisis.PRODUCTOS]: {
    casoUso: 'CU13',
    endpointIA: '/productos/reconocer',
    metodoClient: 'reconocerProductos',
    tablaPersistencia: 'productos_reconocidos',
    enModoContinuo: false,
    descripcion: 'Productos y envases comerciales',
  },
  [TipoAnalisis.COLORES]: {
    casoUso: 'CU14',
    endpointIA: '/colores/reconocer',
    metodoClient: 'reconocerColores',
    tablaPersistencia: 'colores_reconocidos',
    enModoContinuo: false,
    descripcion: 'Color dominante de prendas y objetos',
  },
  [TipoAnalisis.BILLETES]: {
    casoUso: 'CU15/CU16',
    endpointIA: '/billetes/reconocer',
    metodoClient: 'reconocerBillete',
    tablaPersistencia: 'billetes_reconocidos',
    enModoContinuo: false,
    descripcion: 'Billetes: moneda, denominación y autenticidad estimada',
  },
  [TipoAnalisis.DESCRIPCION]: {
    casoUso: 'CU10',
    endpointIA: '/descripciones/generar',
    metodoClient: 'describirEscena',
    tablaPersistencia: 'descripciones_entorno',
    enModoContinuo: true, // narración periódica de contexto
    descripcion: 'Descripción de la escena (composición espacial)',
  },
};

/** Lista de valores válidos para validación (dto @IsIn) */
export const VALORES_TIPO_ANALISIS = Object.values(TipoAnalisis) as string[];