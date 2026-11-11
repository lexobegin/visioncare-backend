/**
 * ══════════════════════════════════════════════════════
 * Constructores de resumen_voz — funciones PURAS.
 *
 * Única fuente de verdad de la redacción hablada por tipo
 * de análisis. Consumidas por:
 *   - capturas.service.ts     (análisis puntual, T5)
 *   - analisis-continuo.service.ts (modo continuo, T6/T19)
 *
 * Regla: SIEMPRE devuelven algo hablable — nunca silencio.
 * ══════════════════════════════════════════════════════
 */

import type {
  ItemProductoDto,
  ItemSenalDto,
  ResultadoBilleteDto,
  ResultadoColoresDto,
  ResultadoOcrDto,
} from './dto';
import type { DeteccionIA } from './entities/deteccion-ia.entity';

/** Máximo de texto OCR que se lee por voz (caracteres) */
export const MAX_VOZ_OCR = 250;

/** Nombres de monedas para TTS (ampliable en Sprint 3) */
export const MONEDAS_VOZ: Record<string, string> = {
  BOB: 'bolivianos',
  USD: 'dólares',
  EUR: 'euros',
  PEN: 'soles',
  ARS: 'pesos argentinos',
  BRL: 'reales',
};

/** Diccionario COCO → español (canónico para el backend) */
export function traducirEtiqueta(etiqueta: string): string {
  const diccionario: Record<string, string> = {
    person: 'persona',
    bicycle: 'bicicleta',
    car: 'auto',
    motorcycle: 'motocicleta',
    bus: 'bus',
    truck: 'camión',
    'traffic light': 'semáforo',
    'stop sign': 'señal de stop',
    bench: 'banca',
    dog: 'perro',
    cat: 'gato',
    backpack: 'mochila',
    handbag: 'bolso',
    bottle: 'botella',
    cup: 'taza',
    chair: 'silla',
    'potted plant': 'planta',
    'cell phone': 'teléfono',
    laptop: 'computadora',
    tv: 'pantalla',
    door: 'puerta',
    tree: 'árbol',
  };
  return diccionario[etiqueta.toLowerCase()] ?? etiqueta;
}

// ═══════════════ OBJETOS (CU08) ═══════════════

export function construirResumenObjetos(detecciones: DeteccionIA[]): string {
  if (detecciones.length === 0) {
    return 'No se detectaron objetos claros en la imagen.';
  }
  const conteos = new Map<string, number>();
  for (const d of detecciones) {
    const etiqueta = traducirEtiqueta(d.etiqueta);
    conteos.set(etiqueta, (conteos.get(etiqueta) ?? 0) + 1);
  }
  const partes = [...conteos.entries()].map(([etiqueta, n]) =>
    n === 1 ? `1 ${etiqueta}` : `${n} ${etiqueta}s`,
  );
  return `Se detectaron: ${partes.join(', ')}.`;
}

// ═══════════════ OCR (CU11) ═══════════════

export function construirResumenOCR(ocr: ResultadoOcrDto): string {
  const texto = ocr.texto_extraido.replace(/\s+/g, ' ').trim();
  if (!texto) {
    return 'No pude leer texto claro en la imagen. Acerca la cámara más al texto.';
  }
  const textoVoz =
    texto.length > MAX_VOZ_OCR
      ? `${texto.slice(0, MAX_VOZ_OCR)}… Texto truncado.`
      : texto;
  return `El texto dice: ${textoVoz}`;
}

// ═══════════════ SEÑALES (CU12) ═══════════════

export function construirResumenSenales(r: {
  senales: ItemSenalDto[];
}): string {
  if (r.senales.length === 0) {
    return 'No detecté señales ni lugares de referencia en la imagen.';
  }
  const nombres = r.senales.map(
    (s) => (s.nombre_reconocido ?? s.tipo_senal).replace(/_/g, ' '),
  );
  if (nombres.length === 1) {
    return `Atención: ${nombres[0]} detectada.`;
  }
  return `Se detectaron: ${nombres.join(', ')}.`;
}

// ═══════════════ PRODUCTOS (CU13) ═══════════════

export function construirResumenProductos(r: {
  productos: ItemProductoDto[];
}): string {
  if (r.productos.length === 0) {
    return 'No pude identificar productos claros. Acerca la cámara al producto.';
  }
  const p = r.productos[0];
  const nombre =
    p.nombre_producto ??
    (p.categoria
      ? `un objeto de categoría ${p.categoria}`
      : 'un objeto no identificado');
  const marca = p.marca ? `, marca ${p.marca}` : '';
  const extra =
    r.productos.length > 1
      ? `. También detecté ${r.productos.length - 1} producto(s) más.`
      : '';
  return `El producto parece ser: ${nombre}${marca}.${extra}`;
}

// ═══════════════ COLORES (CU14) ═══════════════

export function construirResumenColores(r: ResultadoColoresDto): string {
  const secundarios = r.colores_secundarios?.length
    ? `, con tonos de ${r.colores_secundarios.join(' y ')}`
    : '';
  return `El color principal es ${r.color_principal}${secundarios}.`;
}

// ═══════════════ BILLETES (CU15/16) ═══════════════

export function construirResumenBillete(r: ResultadoBilleteDto): string {
  if (!r.denominacion) {
    return (
      'No pude identificar el valor del billete. ' +
      'Colócalo plano frente a la cámara con buena luz.'
    );
  }

  const monedaVoz =
    (r.moneda && MONEDAS_VOZ[r.moneda.toUpperCase()]) ??
    r.moneda?.toLowerCase() ??
    '';
  let resumen = `Billete de ${r.denominacion} ${monedaVoz}.`;

  switch (r.autenticidad_estimacion) {
    case 'PROBABLEMENTE_AUTENTICO':
      resumen += ' Los patrones visuales parecen consistentes.';
      break;
    case 'PROBABLEMENTE_SOSPECHOSO':
      resumen +=
        ' Atención: detecté características sospechosas. ' +
        'Te sugiero verificar con otra persona si es posible.';
      break;
    case 'INDETERMINADO':
    default:
      resumen += ' No pude determinar la autenticidad con certeza.';
      break;
  }

  return resumen;
}