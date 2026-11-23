/**
 * Contraste de color según WCAG 2.x, sin dependencias. Sirve para comprobar las paletas de las
 * cartas (texto ≥ 4,5:1; iconos y formas ≥ 3:1) y para elegir la superficie neutra de las
 * caras sin foto.
 */

/** Color en hexadecimal: «#F7739E», «F7739E» o la forma corta «#FC3». */
export type Hex = string;

/** Componentes RGB de 0 a 255. Lanza un error si el color no es un hexadecimal válido. */
export function rgbDeHex(hex: Hex): [number, number, number] {
  const limpio = hex.trim().replace(/^#/, "");
  const largo = /^[0-9a-f]{3}$/i.test(limpio) ? [...limpio].map((c) => c + c).join("") : limpio;
  if (!/^[0-9a-f]{6}$/i.test(largo)) throw new Error(`Color no válido: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(largo.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminancia relativa (0 = negro, 1 = blanco). */
export function luminancia(hex: Hex): number {
  const [r, g, b] = rgbDeHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste entre dos colores, de 1 (iguales) a 21 (negro sobre blanco). */
export function contraste(a: Hex, b: Hex): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mínimos de WCAG 2.1 AA. */
export const CONTRASTE_TEXTO = 4.5;
export const CONTRASTE_GRAFICO = 3;
