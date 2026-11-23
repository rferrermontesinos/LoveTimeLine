/**
 * Reparte los iconos de mecánicas en el hueco reservado de las cartas.
 * Cada carta lleva como mucho un icono. La estrella la elige el cliente; el resto se
 * reparte de forma estable (la misma carta recibe siempre el mismo icono).
 */
export interface MecanicaIcono {
  id: string;
  icono: string;
  asignacion: "manual" | "automatica";
  maxCartas?: number;
  cadaN?: number;
}

export interface CartaMecanica {
  id: string;
  /** El cliente la marcó como recuerdo estrella. */
  destacada: boolean;
}

/** FNV-1a de 32 bits: reparto estable sin dependencias. */
export function hashTexto(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function asignarIconos(cartas: readonly CartaMecanica[], mecanicas: readonly MecanicaIcono[]): Map<string, string> {
  const resultado = new Map<string, string>();
  for (const m of mecanicas.filter((x) => x.asignacion === "manual")) {
    const max = m.maxCartas ?? Infinity;
    for (const c of cartas.filter((x) => x.destacada).slice(0, max)) {
      if (!resultado.has(c.id)) resultado.set(c.id, m.icono);
    }
  }
  for (const m of mecanicas.filter((x) => x.asignacion === "automatica")) {
    const n = m.cadaN ?? 4;
    const cuantas = Math.floor(cartas.length / n);
    const libres = cartas
      .filter((c) => !resultado.has(c.id))
      .map((c) => ({ c, h: hashTexto(`${m.id}:${c.id}`) }))
      .sort((a, b) => a.h - b.h || a.c.id.localeCompare(b.c.id));
    for (const { c } of libres.slice(0, cuantas)) resultado.set(c.id, m.icono);
  }
  return resultado;
}
