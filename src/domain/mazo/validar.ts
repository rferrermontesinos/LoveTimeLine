import { aIso, esFutura, type FechaCarta } from "../fechas/fecha";

export const MAX_DESCRIPCION = 90;
/** Título de la portada y de la caja. */
export const MAX_TITULO = 32;
/** Dedicatoria del reverso de la portada. */
export const MAX_DEDICATORIA = 140;

export interface CartaParaValidar {
  id: string;
  fecha: FechaCarta | null;
  revisar: boolean;
  hash: string | null;
  descripcion: string;
  /** Resolución efectiva con el recorte actual; null si aún no se conoce. */
  ppp: number | null;
  /** El cliente ya confirmó que quiere imprimirla aunque tenga poca resolución. */
  pppConfirmado: boolean;
}

export type Aviso =
  | { tipo: "faltan-cartas"; faltan: number; minimo: number }
  | { tipo: "excede-maximo"; maximo: number }
  | { tipo: "sin-fecha"; cartas: string[] }
  | { tipo: "fecha-futura"; cartas: string[] }
  | { tipo: "descripcion-larga"; cartas: string[] }
  | { tipo: "baja-resolucion"; cartas: string[] }
  | { tipo: "revisar-fechas"; cartas: string[] }
  | { tipo: "fechas-duplicadas"; grupos: { iso: string; cartas: string[] }[] }
  | { tipo: "fotos-duplicadas"; grupos: string[][] };

export type Gravedad = "bloquea" | "confirmar" | "aviso";

export const GRAVEDAD: Record<Aviso["tipo"], Gravedad> = {
  "faltan-cartas": "bloquea",
  "excede-maximo": "bloquea",
  "sin-fecha": "bloquea",
  "fecha-futura": "bloquea",
  "descripcion-larga": "bloquea",
  // Pide confirmación al cliente, pero no bloquea: puede imprimirla igualmente.
  "baja-resolucion": "confirmar",
  "revisar-fechas": "aviso",
  "fechas-duplicadas": "aviso",
  "fotos-duplicadas": "aviso",
};

export interface ResultadoValidacion {
  avisos: Aviso[];
  puedePagar: boolean;
}

export function validarMazo(e: {
  cartas: CartaParaValidar[];
  minimo: number;
  maximo: number;
  hoy: Date;
  pppMinimo: number;
}): ResultadoValidacion {
  const { cartas } = e;
  const avisos: Aviso[] = [];

  if (cartas.length < e.minimo) avisos.push({ tipo: "faltan-cartas", faltan: e.minimo - cartas.length, minimo: e.minimo });
  if (cartas.length > e.maximo) avisos.push({ tipo: "excede-maximo", maximo: e.maximo });

  const sinFecha = cartas.filter((c) => !c.fecha).map((c) => c.id);
  if (sinFecha.length) avisos.push({ tipo: "sin-fecha", cartas: sinFecha });

  const futuras = cartas.filter((c) => c.fecha && esFutura(c.fecha, e.hoy)).map((c) => c.id);
  if (futuras.length) avisos.push({ tipo: "fecha-futura", cartas: futuras });

  const largas = cartas.filter((c) => [...c.descripcion].length > MAX_DESCRIPCION).map((c) => c.id);
  if (largas.length) avisos.push({ tipo: "descripcion-larga", cartas: largas });

  const baja = cartas.filter((c) => c.ppp !== null && c.ppp < e.pppMinimo && !c.pppConfirmado).map((c) => c.id);
  if (baja.length) avisos.push({ tipo: "baja-resolucion", cartas: baja });

  const revisar = cartas.filter((c) => c.fecha && c.revisar).map((c) => c.id);
  if (revisar.length) avisos.push({ tipo: "revisar-fechas", cartas: revisar });

  const porFecha = agrupar(cartas.filter((c) => c.fecha), (c) => aIso(c.fecha!));
  const fechasDup = [...porFecha.entries()].filter(([, g]) => g.length > 1).map(([iso, g]) => ({ iso, cartas: g.map((c) => c.id) }));
  if (fechasDup.length) avisos.push({ tipo: "fechas-duplicadas", grupos: fechasDup });

  const porHash = agrupar(cartas.filter((c) => c.hash), (c) => c.hash!);
  const fotosDup = [...porHash.values()].filter((g) => g.length > 1).map((g) => g.map((c) => c.id));
  if (fotosDup.length) avisos.push({ tipo: "fotos-duplicadas", grupos: fotosDup });

  const puedePagar = !avisos.some((a) => GRAVEDAD[a.tipo] !== "aviso");
  return { avisos, puedePagar };
}

function agrupar<T>(lista: T[], clave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of lista) {
    const k = clave(x);
    const g = m.get(k);
    if (g) g.push(x);
    else m.set(k, [x]);
  }
  return m;
}
