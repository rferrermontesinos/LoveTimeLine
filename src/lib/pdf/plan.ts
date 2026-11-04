/**
 * Qué se imprime y en qué orden. Sin dibujar nada: así se puede probar sin navegador.
 *
 * Orden: portada, cartas de foto en orden cronológico, cartas de mecánicas (comodines,
 * en blanco), retos si se pidieron y, al final, las dos caras de la caja.
 * Cada carta va como anverso + reverso seguidos, listo para imprimir a doble cara.
 */
import { ordenarPorFecha } from "@/domain/mazo/ordenar";
import type { Rect } from "@/domain/imagen/recorte";
import type { Catalogo } from "@/domain/precios/tipos";
import type { Cara, DatosCarta, TipoCarta } from "@/lib/carta/tipos";
import { cartaPortada, datosCarta, datosPortada } from "@/lib/mazo/derivados";
import type { Mazo } from "@/lib/mazo/tipos";

export interface FotoPlan {
  id: string;
  /** Ancho de la copia de trabajo, en la que están medidos los recortes. */
  anchoCopia: number;
  recorteAnverso: Rect;
  recorteReverso: Rect;
}

export interface CaraPlan {
  cara: Cara;
  datos: Omit<DatosCarta, "foto">;
}

export interface CartaPlan {
  /** «portada», «foto-<id>», «comodin-1», «reto-3», «caja»… */
  clave: string;
  tipo: TipoCarta;
  foto: FotoPlan | null;
  caras: [CaraPlan, CaraPlan];
}

/** Mecánicas que añaden cartas físicas y el tipo de carta que imprimen. */
const CARTAS_DE_MECANICA: Record<string, TipoCarta> = { comodin: "comodin", "en-blanco": "en-blanco" };
/** Extras que añaden cartas impresas. */
const CARTAS_DE_EXTRA: Record<string, TipoCarta> = { "pack-retos": "reto" };

function fotoPlan(c: { id: string; ancho: number; recorteAnverso: Rect; recorteReverso: Rect } | null): FotoPlan | null {
  return c ? { id: c.id, anchoCopia: c.ancho, recorteAnverso: c.recorteAnverso, recorteReverso: c.recorteReverso } : null;
}

function especial(clave: string, tipo: TipoCarta, texto?: string): CartaPlan {
  const datos: Omit<DatosCarta, "foto"> = texto ? { tipo, texto } : { tipo };
  return { clave, tipo, foto: null, caras: [{ cara: "anverso", datos }, { cara: "reverso", datos }] };
}

export function planImpresion(e: { mazo: Mazo; catalogo: Catalogo; iconos: Map<string, string>; retos: string[] }): CartaPlan[] {
  const { mazo, catalogo } = e;
  const plan: CartaPlan[] = [];
  const portada = fotoPlan(cartaPortada(mazo));

  plan.push({
    clave: "portada",
    tipo: "portada",
    foto: portada,
    caras: [
      { cara: "anverso", datos: datosPortada(mazo, "portada", "anverso") },
      { cara: "reverso", datos: datosPortada(mazo, "portada", "reverso") },
    ],
  });

  for (const c of ordenarPorFecha(mazo.cartas)) {
    const datos = datosCarta(c, e.iconos.get(c.id) ?? null);
    plan.push({ clave: `foto-${c.id}`, tipo: "foto", foto: fotoPlan(c), caras: [{ cara: "anverso", datos }, { cara: "reverso", datos }] });
  }

  for (const m of [...catalogo.mecanicas].sort((a, b) => a.orden - b.orden)) {
    const tipo = CARTAS_DE_MECANICA[m.id];
    if (!tipo || m.tipo !== "cartas" || !m.activo || !mazo.mecanicas.includes(m.id)) continue;
    for (let i = 1; i <= (m.cartasFisicas ?? 0); i++) plan.push(especial(`${m.id}-${i}`, tipo));
  }

  for (const x of [...catalogo.extras].sort((a, b) => a.orden - b.orden)) {
    const tipo = CARTAS_DE_EXTRA[x.id];
    if (!tipo || !x.activo || !mazo.extras.includes(x.id)) continue;
    const n = x.cartasFisicas ?? 0;
    for (let i = 1; i <= n; i++) plan.push(especial(`${x.id}-${i}`, tipo, tipo === "reto" ? e.retos[(i - 1) % Math.max(1, e.retos.length)] : undefined));
  }

  plan.push({
    clave: "caja",
    tipo: "caja",
    foto: portada,
    caras: [
      { cara: "anverso", datos: datosPortada(mazo, "caja", "anverso") },
      { cara: "reverso", datos: datosPortada(mazo, "caja", "reverso") },
    ],
  });
  return plan;
}

/** Cartas impresas del plan (la caja no es una carta). */
export function cartasImpresas(plan: CartaPlan[]): number {
  return plan.filter((c) => c.tipo !== "caja").length;
}
