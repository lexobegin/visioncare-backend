/**
 * ══════════════════════════════════════════════════════
 * Catálogo de intenciones de voz de VisionCare AI (CU06).
 *
 * Cada intención mapea a un caso de uso del sistema. La app
 * móvil recibe `accion_app` y ejecuta la función asociada.
 *
 * ORDEN IMPORTANTE = prioridad de detección:
 *   1. Emergencias primero (nunca deben perderse)
 *   2. Intenciones específicas después
 *   3. Genéricas al final
 *
 * Los patrones están en minúsculas y SIN tildes porque el
 * texto se normaliza antes del matching ("¿Qué ves?" →
 * "que ves"). El algoritmo gana la intención con MÁS
 * patrones coincidentes; en empate, la de mayor prioridad.
 * ══════════════════════════════════════════════════════
 */
export interface IntencionVoz {
  /** Código que se persiste en comandos_voz.intencion */
  codigo: string;
  /** Caso de uso del sistema asociado */
  casoUso: string;
  /** Descripción legible (Swagger / admin web) */
  descripcion: string;
  /** Ejemplos de frases (documentación y pruebas) */
  ejemplos: string[];
  /** Regex de detección sobre el texto normalizado */
  patrones: RegExp[];
  /** Acción que debe ejecutar la app móvil */
  accionApp: string;
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

  // ═════════ 2. INTENCIONES ESPECÍFICAS ═════════
  {
    codigo: 'RECONOCER_BILLETES',
    casoUso: 'CU15',
    descripcion: 'Reconocer billetes (moneda y denominación)',
    ejemplos: ['¿qué billete es?', 'reconocer dinero', '¿cuánto vale?'],
    patrones: [
      /\b(billetes?|dinero|monedas?)\b/,
      /\b(cuanto vale este|cuanto es este)\b/,
    ],
    accionApp: 'RECONOCER_BILLETES',
    respuestaVoz: 'Reconociendo el billete.',
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
    respuestaVoz: 'Identificando el color.',
  },
  {
    codigo: 'RECONOCER_PRODUCTOS',
    casoUso: 'CU13',
    descripcion: 'Identificar productos y objetos comerciales',
    ejemplos: ['¿qué producto es esto?', 'reconocer producto'],
    patrones: [
      /\b(productos?|envases?|etiquetas?)\b/,
      /\b(que producto)\b/,
    ],
    accionApp: 'RECONOCER_PRODUCTOS',
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
    respuestaVoz: 'Leyendo el texto.',
  },
  {
    codigo: 'DETECTAR_OBSTACULOS',
    casoUso: 'CU09',
    descripcion: 'Detectar obstáculos y riesgos en el desplazamiento',
    ejemplos: ['detectar obstáculos', '¿hay peligro adelante?'],
    patrones: [
      /\b(obstaculos?|peligros?|riesgos?)\b/,
    ],
    accionApp: 'DETECTAR_OBSTACULOS',
    respuestaVoz: 'Detectando obstáculos en tu camino.',
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
    respuestaVoz: 'Analizando los objetos de tu entorno.',
  },
  {
    codigo: 'INICIAR_NAVEGACION',
    casoUso: 'CU24',
    descripcion: 'Iniciar navegación asistida hacia un destino',
    ejemplos: ['llévame a la plaza', 'navegar al mercado', '¿cómo llego al banco?'],
    patrones: [
      /\b(llevame a|navegar|como llego|navegacion)\b/,
    ],
    accionApp: 'INICIAR_NAVEGACION',
    respuestaVoz: 'Iniciando la navegación.',
  },

  // ═════════ 3. INTENCIONES GENERALES ═════════
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
    descripcion: 'Capturar una foto del entorno para análisis',
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
    '¿de qué color es?, o ayuda.',
};

/** Normaliza el texto: minúsculas, sin tildes ni signos de puntuación */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // elimina diacríticos (á→a, é→e…)
    .replace(/[¿?¡!.,;:"'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}