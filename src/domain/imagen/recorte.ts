/**
 * Geometría de recortes. Todo en píxeles de la imagen de origen (ya rotada).
 * Las proporciones se pasan como ancho/alto.
 */
export interface Rect {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

const MM_POR_PULGADA = 25.4;

/** Recorte centrado más grande posible con la proporción pedida (como object-fit: cover). */
export function recorteCentrado(anchoImg: number, altoImg: number, proporcion: number): Rect {
  let ancho = anchoImg;
  let alto = ancho / proporcion;
  if (alto > altoImg) {
    alto = altoImg;
    ancho = alto * proporcion;
  }
  return { x: (anchoImg - ancho) / 2, y: (altoImg - alto) / 2, ancho, alto };
}

/** Mantiene un rectángulo dentro de la imagen sin cambiar su tamaño (si cabe). */
export function encajar(r: Rect, anchoImg: number, altoImg: number): Rect {
  const ancho = Math.min(r.ancho, anchoImg);
  const alto = Math.min(r.alto, altoImg);
  const x = Math.min(Math.max(0, r.x), anchoImg - ancho);
  const y = Math.min(Math.max(0, r.y), altoImg - alto);
  return { x, y, ancho, alto };
}

/**
 * Recorte del reverso a partir del anverso: mismo centro, la mayor caja con la proporción
 * del reverso que cabe dentro del recorte del anverso (y, si no cabe, dentro de la imagen).
 */
export function recorteReversoDesdeAnverso(anverso: Rect, proporcionReverso: number, anchoImg: number, altoImg: number): Rect {
  const cx = anverso.x + anverso.ancho / 2;
  const cy = anverso.y + anverso.alto / 2;
  let ancho = anverso.ancho;
  let alto = ancho / proporcionReverso;
  if (alto > anverso.alto) {
    alto = anverso.alto;
    ancho = alto * proporcionReverso;
  }
  // Un poco por encima del centro: en las fotos las caras suelen estar en el tercio superior.
  const desplazamiento = Math.min((anverso.alto - alto) / 2, anverso.alto * 0.12);
  return encajar({ x: cx - ancho / 2, y: cy - alto / 2 - desplazamiento, ancho, alto }, anchoImg, altoImg);
}

/** Resolución efectiva (ppp) de un recorte impreso a un ancho en milímetros. */
export function pppEfectivo(recorte: Rect, anchoImpresoMm: number): number {
  return recorte.ancho / (anchoImpresoMm / MM_POR_PULGADA);
}

/** Tamaño de una imagen tras rotarla en múltiplos de 90°. */
export function tamanoRotado(ancho: number, alto: number, rotacion: number): { ancho: number; alto: number } {
  const r = ((rotacion % 360) + 360) % 360;
  return r === 90 || r === 270 ? { ancho: alto, alto: ancho } : { ancho, alto };
}

/** Escala un rectángulo (por ejemplo, de la copia de trabajo a la miniatura). */
export function escalarRect(r: Rect, factor: number): Rect {
  return { x: r.x * factor, y: r.y * factor, ancho: r.ancho * factor, alto: r.alto * factor };
}

/** Lado mayor limitado, conservando la proporción. */
export function limitarLado(ancho: number, alto: number, ladoMax: number): { ancho: number; alto: number; factor: number } {
  const factor = Math.min(1, ladoMax / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor), factor };
}
