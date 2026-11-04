/**
 * Qué se imprime y en qué orden. Sin dibujar nada: así se puede probar sin navegador.
 *
 * Orden: portada, cartas de recuerdo (con foto o de texto) en orden cronológico, cartas de
 * mecánicas (comodines, en blanco) y, al final, las dos caras de la caja si es la personalizada.
 * La caja de siempre es packaging de stock: no va en el archivo de impresión del pedido.
 * Cada carta va como anverso + reverso seguidos, listo para imprimir a doble cara.
 */
import { ordenarPorFecha } from "@/domain/mazo/ordenar";
import type { Rect } from "@/domain/imagen/recorte";
import type { Catalogo, Mecanica } from "@/domain/precios/tipos";
import type { Cara, DatosCarta, TipoCarta } from "@/lib/carta/tipos";
import { cartaPortada, datosCaja, datosCarta, datosPortada, esCajaPersonalizada, fotoCaja } from "@/lib/mazo/derivados";
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
  /** «portada», «foto-<id>», «texto-<id>», «comodin-1», «en-blanco-3», «caja». */
  clave: string;
  tipo: TipoCarta;
  foto: FotoPlan | null;
  caras: [CaraPlan, CaraPlan];
}

/** Mecánicas que añaden cartas físicas y el tipo de cara que imprimen. El icono sale del catálogo. */
const CARTAS_DE_MECANICA: Record<string, TipoCarta> = { comodin: "comodin", "en-blanco": "en-blanco" };

function fotoPlan(c: { id: string; ancho: number; recorteAnverso: Rect; recorteReverso: Rect } | null): FotoPlan | null {
  return c ? { id: c.id, anchoCopia: c.ancho, recorteAnverso: c.recorteAnverso, recorteReverso: c.recorteReverso } : null;
}

function especial(clave: string, tipo: TipoCarta, m: Pick<Mecanica, "icono">): CartaPlan {
  const datos: Omit<DatosCarta, "foto"> = { tipo, icono: m.icono ?? null };
  return { clave, tipo, foto: null, caras: [{ cara: "anverso", datos }, { cara: "reverso", datos }] };
}

export function planImpresion(e: { mazo: Mazo; catalogo: Catalogo; iconos: Map<string, string> }): CartaPlan[] {
  const { mazo, catalogo } = e;
  const plan: CartaPlan[] = [];

  plan.push({
    clave: "portada",
    tipo: "portada",
    foto: fotoPlan(cartaPortada(mazo)),
    caras: [
      { cara: "anverso", datos: datosPortada(mazo, "anverso") },
      { cara: "reverso", datos: datosPortada(mazo, "reverso") },
    ],
  });

  for (const c of ordenarPorFecha(mazo.cartas)) {
    const datos = datosCarta(c, e.iconos.get(c.id) ?? null);
    const caras: [CaraPlan, CaraPlan] = [{ cara: "anverso", datos }, { cara: "reverso", datos }];
    if (c.tipo === "foto") plan.push({ clave: `foto-${c.id}`, tipo: "foto", foto: fotoPlan(c), caras });
    else plan.push({ clave: `texto-${c.id}`, tipo: "texto", foto: null, caras });
  }

  for (const m of [...catalogo.mecanicas].sort((a, b) => a.orden - b.orden)) {
    const tipo = CARTAS_DE_MECANICA[m.id];
    if (!tipo || m.tipo !== "cartas" || !m.activo || !mazo.mecanicas.includes(m.id)) continue;
    for (let i = 1; i <= (m.cartasFisicas ?? 0); i++) plan.push(especial(`${m.id}-${i}`, tipo, m));
  }

  if (esCajaPersonalizada(mazo, catalogo)) {
    const f = fotoCaja(mazo);
    plan.push({
      clave: "caja",
      tipo: "caja",
      foto: f ? { id: f.id, anchoCopia: f.ancho, recorteAnverso: f.recorte, recorteReverso: f.recorte } : null,
      caras: [
        { cara: "anverso", datos: datosCaja(mazo, "anverso", "personalizada") },
        { cara: "reverso", datos: datosCaja(mazo, "reverso", "personalizada") },
      ],
    });
  }
  return plan;
}

/** Cartas impresas del plan (la caja no es una carta). */
export function cartasImpresas(plan: CartaPlan[]): number {
  return plan.filter((c) => c.tipo !== "caja").length;
}
