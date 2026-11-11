import { TipoAnalisis } from '../capturas/dto/tipo-analisis.enum';

/**
 * ══════════════════════════════════════════════════════
 * Catálogo de intenciones de voz (CU06) — SPRINT 2.
 *
 * Cada intención mapea a un caso de uso y, para los análisis
 * visuales, incluye `tipoAnalisis` (catálogo de la Tanda 3):
 * la app móvil abre la cámara con ESE análisis pre-seleccionado
 * y el usuario solo confirma capturando.
 *
 * CAMBIOS S2:
 *   + ACTIVAR_ASISTENTE / DETENER_ASISTENTE (Modo Continuo)
 *   ~ DETECTAR_OBSTACULOS → activa el Modo Continuo (HU09 es
 *     continua: el asistente del pecho acompaña caminando)
 *   + tipoAnalisis en las intenciones de análisis visual
 *
 * ORDEN = prioridad de detección:
 *   1. Emergencias (nunca se pierden)
 *   2. Control del asistente
 *   3. Análisis específicos
 *   4. Genéricas
 *
 * Patrones en minúsculas y SIN tildes (el texto se normaliza).
 * Gana la intención con MÁS patrones coincidentes; empate →
 * la de mayor prioridad en el catálogo.
 * ══════════════════════════════════════════════════════
 */
export interface IntencionVoz {
  /** Código que se persiste en comandos_voz.intencion */
  codigo: string;
  /** Caso de uso del sistema asociado */
  casoUso: string;
  descripcion: string;
  ejemplos: string[];
  /** Regex sobre el texto normalizado */
  patrones: RegExp[];
  /** Acción que ejecuta la app móvil */
  accionApp: string;
  /** S2 — análisis pre-seleccionado (si aplica) */
  tipoAnalisis?: TipoAnalisis;
  /** Texto sugerido para el TTS */
  respuestaVoz: string;
}

export const INTENCIONES_VOZ: IntencionVoz[] = [
  // ═════════ 1. PRIORIDAD CRÍTICA ═════════
  {
    codigo: 'SOLICITAR_AYUDA',
    casoUso: 'CU20',
    descripcion: 'Solicitar ayuda o emergencia a contactos de confianza',
    ejemplos: ['ayuda', 'socorro', 'necesito ayuda', 'emergencia'],
    patrones: [
      /\b(ayuda|ayudame|auxilio|socorro|emergencias?)\b/,
      /\b(necesito ayuda|manda ayuda|llama a alguien|estoy en peligro)\b/,
    ],
    accionApp: 'ABRIR_SOLICITUD_AYUDA',
    respuestaVoz: 'Solicitando ayuda a tus contactos de confianza.',
  },
  {
    codigo: 'COMPARTIR_UBICACION',
    casoUso: 'CU21',
    descripcion: 'Compartir la ubicación con contactos autorizados',
    ejemplos: ['compartir mi ubicación', 'envía mi ubicación'],
    patrones: [
      /\b(compartir (mi )?ubicacion|enviar (mi )?ubicacion|envia (mi )?ubicacion)\b/,
    ],
    accionApp: 'COMPARTIR_UBICACION',
    respuestaVoz: 'Compartiendo tu ubicación con tus contactos.',
  },

  // ═════════ 2. CONTROL DEL ASISTENTE (Modo Continuo) ═════════
  {
    codigo: 'ACTIVAR_ASISTENTE',
    casoUso: 'CU09',
    descripcion:
      'Activar el Modo Continuo: narración automática del entorno',
    ejemplos: ['activa el asistente', 'modo continuo', 'acompañame'],
    patrones: [
      /\b(activa|activar|enciende|inicia|empieza)\b.*\b(asistente|modo continuo|acompanamiento)\b/,
      /\b(modo continuo|asistente continuo)\b/,
      /\b(acompaname|guiame caminando)\b/,
    ],
    accionApp: 'ACTIVAR_MODO_CONTINUO',
    respuestaVoz:
      'Modo asistente activado. Te iré informando de lo que hay al frente.',
  },
  {
    codigo: 'DETENER_ASISTENTE',
    casoUso: 'CU09',
    descripcion: 'Desactivar el Modo Continuo',
    ejemplos: ['detén el asistente', 'para el asistente', 'modo manual'],
    patrones: [
      /\b(deten|detener|para|desactiva|apaga|cierra|quita)\b.*\b(asistente|modo continuo)\b/,
      /\b(modo manual|suficiente|ya basta)\b/,
    ],
    accionApp: 'DETENER_MODO_CONTINUO',
    respuestaVoz: 'Modo asistente desactivado.',
  },

  // ═════════ 3. ANÁLISIS ESPECÍFICOS (con tipoAnalisis) ═════════
  {
    codigo: 'RECONOCER_BILLETES',
    casoUso: 'CU15',
    descripcion: 'Reconocer billetes (moneda, denominación y autenticidad)',
    ejemplos: ['¿qué billete es?', 'reconocer dinero', '¿cuánto vale?'],
    patrones: [
      /\b(billetes?|dinero)\b/,
      /\b(cuanto vale este|cuanto es este|que valor tiene)\b/,
    ],
    accionApp: 'RECONOCER_BILLETES',
    tipoAnalisis: TipoAnalisis.BILLETES,
    respuestaVoz: 'Reconociendo el billete. Colócalo plano frente a la cámara.',
  },
  {
    codigo: 'RECONOCER_COLORES',
    casoUso: 'CU14',
    descripcion: 'Identificar el color de prendas y objetos',
    ejemplos: ['¿de qué color es?', 'reconocer color'],
    patrones: [
      /\b(colores?)\b/,
      /\b(de que color|que color tiene)\b/,
    ],
    accionApp: 'RECONOCER_COLORES',
    tipoAnalisis: TipoAnalisis.COLORES,
    respuestaVoz: 'Identificando el color.',
  },
  {
    codigo: 'RECONOCER_PRODUCTOS',
    casoUso: 'CU13',
    descripcion: 'Identificar productos y objetos comerciales',
    ejemplos: ['¿qué producto es esto?', 'reconocer producto'],
    patrones: [
      /\b(productos?|envases?|empaques?)\b/,
      /\b(que producto)\b/,
    ],
    accionApp: 'RECONOCER_PRODUCTOS',
    tipoAnalisis: TipoAnalisis.PRODUCTOS,
    respuestaVoz: 'Identificando el producto.',
  },
  {
    codigo: 'RECONOCER_SENALES',
    casoUso: 'CU12',
    descripcion: 'Reconocer señales, salidas, baños y lugares clave',
    ejemplos: ['¿dónde está la salida?', 'reconocer señales', '¿hay un baño cerca?'],
    patrones: [
      /\b(senales?|salidas?|banos?|escaleras?|crucero?|puertas?)\b/,
      /\b(donde esta la salida|donde hay un bano|donde estan las escaleras)\b/,
    ],
    accionApp: 'RECONOCER_SENALES',
    tipoAnalisis: TipoAnalisis.SENALES,
    respuestaVoz: 'Buscando señales y lugares de interés.',
  },
  {
    codigo: 'LEER_TEXTO',
    casoUso: 'CU11',
    descripcion: 'Leer textos mediante OCR (carteles, etiquetas, menús)',
    ejemplos: ['lee esto', 'leer texto', '¿qué dice el cartel?'],
    patrones: [
      /\b(leer|lee|leeme|lectura)\b/,
      /\b(que dice|lee el texto|leer texto)\b/,
    ],
    accionApp: 'LEER_TEXTO',
    tipoAnalisis: TipoAnalisis.OCR,
    respuestaVoz: 'Leyendo el texto. Acerca la cámara a lo que quieres leer.',
  },
  {
    codigo: 'DESCRIBIR_ENTORNO',
    casoUso: 'CU10',
    descripcion: 'Describir la escena capturada por la cámara',
    ejemplos: ['describe el entorno', '¿qué hay alrededor?', '¿dónde estoy?'],
    patrones: [
      /\b(describe|describeme|describir)\b/,
      /\b(alrededor|que hay alrededor|donde estoy)\b/,
    ],
    accionApp: 'DESCRIBIR_ENTORNO',
    tipoAnalisis: TipoAnalisis.DESCRIPCION,
    respuestaVoz: 'Describiendo tu entorno.',
  },
  {
    codigo: 'RECONOCER_OBJETOS',
    casoUso: 'CU08',
    descripcion: 'Reconocer objetos y personas del entorno',
    ejemplos: ['¿qué ves?', '¿qué hay delante?', 'reconocer objetos'],
    patrones: [
      /\b(que ves|que hay|objetos?)\b/,
      /\b(reconocer objetos|identifica objetos|que tengo enfrente|que ves delante)\b/,
    ],
    accionApp: 'RECONOCER_OBJETOS',
    tipoAnalisis: TipoAnalisis.OBJETOS,
    respuestaVoz: 'Analizando los objetos de tu entorno.',
  },
  {
    codigo: 'DETECTAR_OBSTACULOS',
    casoUso: 'CU09',
    descripcion:
      'Detección de obstáculos — activa el Modo Continuo (narración automática)',
    ejemplos: ['detectar obstáculos', '¿hay peligro adelante?'],
    patrones: [
      /\b(obstaculos?|peligros?|riesgos?)\b/,
    ],
    accionApp: 'ACTIVAR_MODO_CONTINUO', // 🆕 S2: HU09 es continua
    tipoAnalisis: TipoAnalisis.OBJETOS,
    respuestaVoz:
      'Activando la detección de obstáculos. Te avisaré si hay peligro al frente.',
  },

  // ═════════ 4. INTENCIONES GENERALES ═════════
  {
    codigo: 'INICIAR_NAVEGACION',
    casoUso: 'CU24',
    descripcion: 'Iniciar navegación asistida hacia un destino',
    ejemplos: ['llévame a la plaza', 'navegar al mercado', '¿cómo llego al banco?'],
    patrones: [
      /\b(llevame a|navegar|como llego|navegacion)\b/,
    ],
    accionApp: 'INICIAR_NAVEGACION',
    respuestaVoz: 'La navegación asistida estará disponible en el Sprint 3.',
  },
  {
    codigo: 'VER_HISTORIAL',
    casoUso: 'CU23',
    descripcion: 'Consultar el historial de actividades',
    ejemplos: ['mi historial', '¿qué hice hoy?'],
    patrones: [
      /\b(historial|actividades)\b/,
      /\b(que hice)\b/,
    ],
    accionApp: 'VER_HISTORIAL',
    respuestaVoz: 'Abriendo tu historial de actividades.',
  },
  {
    codigo: 'CAPTURAR_ENTORNO',
    casoUso: 'CU07',
    descripcion: 'Capturar y guardar una foto del entorno',
    ejemplos: ['captura', 'toma una foto', 'mira esto'],
    patrones: [
      /\b(captura|capturar|fotografias?)\b/,
      /\b(toma una foto|saca una foto|mira esto)\b/,
    ],
    accionApp: 'ABRIR_CAMARA',
    respuestaVoz: 'Capturando el entorno.',
  },
];

/** Respuesta cuando ningún patrón coincide */
export const INTENCION_DESCONOCIDA = {
  codigo: 'DESCONOCIDA',
  casoUso: null as string | null,
  accionApp: 'NINGUNA',
  respuestaVoz:
    'No entendí el comando. Puedes decir: ¿qué ves?, lee esto, ' +
    '¿de qué color es?, ¿qué billete es?, activa el asistente, o ayuda.',
};

/** Normaliza el texto: minúsculas, sin tildes ni puntuación */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:"'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}