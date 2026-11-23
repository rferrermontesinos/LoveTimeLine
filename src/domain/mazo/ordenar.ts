import { compararFechas, type FechaCarta } from "../fechas/fecha";

/** Orden cronológico estable; las cartas sin fecha van al final en su orden actual. */
export function ordenarPorFecha<T extends { fecha: FechaCarta | null }>(cartas: readonly T[]): T[] {
  return cartas
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      if (!a.c.fecha && !b.c.fecha) return a.i - b.i;
      if (!a.c.fecha) return 1;
      if (!b.c.fecha) return -1;
      return compararFechas(a.c.fecha, b.c.fecha) || a.i - b.i;
    })
    .map((x) => x.c);
}

/** Agrupa por año para la vista previa de la línea temporal. */
export function agruparPorAnio<T extends { fecha: FechaCarta | null }>(cartas: readonly T[]): { anio: number | null; cartas: T[] }[] {
  const grupos: { anio: number | null; cartas: T[] }[] = [];
  for (const c of ordenarPorFecha(cartas)) {
    const anio = c.fecha?.anio ?? null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.anio === anio) ultimo.cartas.push(c);
    else grupos.push({ anio, cartas: [c] });
  }
  return grupos;
}

/** Primer y último año del mazo, para la portada («2012–2026»). */
export function rangoAnios(cartas: readonly { fecha: FechaCarta | null }[]): [number, number] | null {
  const anios = cartas.flatMap((c) => (c.fecha ? [c.fecha.anio] : []));
  if (anios.length === 0) return null;
  return [Math.min(...anios), Math.max(...anios)];
}

/**
 * Índice de la siguiente carta que cumple una condición a partir de una posición (da la vuelta
 * al final y acaba en la propia carta de partida). -1 si ninguna la cumple.
 */
export function siguienteQue<T>(cartas: readonly T[], desde: number, cumple: (c: T) => boolean): number {
  const n = cartas.length;
  for (let k = 1; k <= n; k++) {
    const i = (((desde + k) % n) + n) % n;
    if (cumple(cartas[i]!)) return i;
  }
  return -1;
}

/** Índice de la siguiente carta sin fecha a partir de una posición (da la vuelta al final). */
export function siguienteSinFecha(cartas: readonly { fecha: FechaCarta | null }[], desde: number): number {
  return siguienteQue(cartas, desde, (c) => !c.fecha);
}
