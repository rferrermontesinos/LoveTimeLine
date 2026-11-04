/**
 * Formato de impresión. Provisional: se fija tras las pruebas de impresión.
 * Es el único sitio con medidas físicas; el resto del código las lee de aquí.
 */
export const PRINT = {
  /** Carta terminada (formato póker, el estándar de las imprentas de cartas a medida). */
  carta: { anchoMm: 63, altoMm: 88, radioEsquinaMm: 3 },
  /** Sangrado por cada lado. */
  sangradoMm: 3,
  /** Distancia mínima del texto importante al borde de corte. */
  zonaSeguraMm: 4,
  /** Resolución de salida de las caras rasterizadas. */
  ppp: 300,
  /** Por debajo de esta resolución efectiva se avisa y se pide confirmación, sin bloquear. */
  pppMinimo: 300,
  /** Marcas de corte en un margen fuera del sangrado. Algunas imprentas las prefieren desactivadas. */
  marcasCorte: { activas: true, margenMm: 6, largoMm: 4, separacionMm: 1, grosorPt: 0.25 },
  /** Compresión JPEG de cada cara en el PDF. */
  calidadJpeg: 0.92,
  /** Folleto de instrucciones: 4 × 2 paneles del tamaño de una carta, plegado en mapa. */
  folleto: { columnas: 4, filas: 2 },
  /** Lado mayor de la copia de trabajo de cada foto en el navegador. */
  ladoMaximoCopiaPx: 3200,
  /** Lado mayor de las miniaturas de la cuadrícula. */
  ladoMiniaturaPx: 480,
} as const;

export const MM_POR_PULGADA = 25.4;

/** Tamaño de una cara con sangrado, en milímetros. */
export function caraConSangradoMm() {
  return {
    ancho: PRINT.carta.anchoMm + 2 * PRINT.sangradoMm,
    alto: PRINT.carta.altoMm + 2 * PRINT.sangradoMm,
  };
}

/** Milímetros a píxeles a una resolución dada. */
export function mmAPx(mm: number, ppp: number = PRINT.ppp) {
  return (mm / MM_POR_PULGADA) * ppp;
}
