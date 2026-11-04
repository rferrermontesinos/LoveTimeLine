import type { Catalogo, Extra, Mecanica, Pack } from "./tipos";

export class ErrorCotizacion extends Error {
  constructor(
    public readonly codigo: "pack-desconocido" | "extra-desconocido" | "mecanica-desconocida" | "cartas-invalidas",
    detalle: string,
  ) {
    super(`${codigo}: ${detalle}`);
    this.name = "ErrorCotizacion";
  }
}

export interface EntradaCotizacion {
  catalogo: Catalogo;
  /** Pack elegido: marca el mínimo de cartas para pagar. */
  packId: string;
  /** Cartas de recuerdo del mazo, con foto o de texto: se cobran igual. */
  cartas: number;
  extras?: string[];
  mecanicas?: string[];
}

export type TipoLinea = "pack" | "cartas-extra" | "caja" | "extra" | "mecanica" | "envio";

export interface LineaCotizacion {
  tipo: TipoLinea;
  /** Id del pack, extra o mecánica; «cartas-extra», «caja» o «envio» en el resto. */
  id: string;
  cantidad: number;
  importeCents: number;
}

/**
 * Avisos de oferta, calculados con el mismo catálogo que el precio:
 * · «pack-aplicado»: se cobra un pack mayor, porque sale más barato. Si el mazo aún no tiene sus
 *   cartas, `huecos` dice cuántas caben todavía sin pagar nada más.
 * · «subir»: con unas pocas cartas más se pasa a un pack mayor y sale a cuenta
 *   (diferenciaCents ≤ 0 es pagar lo mismo o menos y tener más cartas).
 * · «bajar»: faltan cartas para el pack elegido, pero un pack menor ya está cubierto.
 */
export type Oferta =
  | { tipo: "pack-aplicado"; pack: Pack; ahorroCents: number; huecos: number }
  | { tipo: "subir"; pack: Pack; cartasMas: number; diferenciaCents: number; ahorroCents: number }
  | { tipo: "bajar"; pack: Pack; totalCents: number };

export interface Cotizacion {
  moneda: string;
  /** Pack elegido por el cliente. */
  pack: Pack;
  /** Pack que se cobra: el elegido o uno mayor si sale más barato (aunque aún no tenga sus cartas). */
  packAplicado: Pack;
  /** Cartas de recuerdo (con foto y de texto). */
  cartas: number;
  /** Mínimo para pagar: las cartas del pack elegido. */
  minimo: number;
  faltan: number;
  /** Cartas que pasan de las incluidas en el pack aplicado. */
  cartasExtra: number;
  precioCartaExtraCents: number;
  /** Cartas impresas: recuerdos (o el mínimo, mientras falten) + portada + mecánicas y extras. */
  cartasFisicas: number;
  cajas: number;
  lineas: LineaCotizacion[];
  totalCents: number;
  sePuedePagar: boolean;
  excedeMaximo: boolean;
  ofertas: Oferta[];
}

/** Carta de portada con el título y la dedicatoria: va siempre incluida. */
export const CARTAS_PORTADA = 1;

/** Packs activos de menor a mayor número de cartas. */
export function packsActivos(catalogo: Catalogo): Pack[] {
  return catalogo.packs.filter((p) => p.activo).sort((a, b) => a.cartas - b.cartas || a.orden - b.orden);
}

/** Pack con el que empieza un mazo nuevo: el primero activo según el orden del catálogo. */
export function packPorDefecto(catalogo: Catalogo): Pack | null {
  return catalogo.packs.filter((p) => p.activo).sort((a, b) => a.orden - b.orden)[0] ?? null;
}

interface Seleccion {
  extras: Extra[];
  mecanicas: Mecanica[];
}

/** Precio de un mazo de n cartas cobrado con un pack concreto, sin ofertas. */
function cotizarCon(catalogo: Catalogo, elegido: Pack, aplicado: Pack, n: number, sel: Seleccion): Omit<Cotizacion, "ofertas"> {
  const faltan = Math.max(0, elegido.cartas - n);
  const cartasExtra = Math.max(0, n - aplicado.cartas);

  const cartasMecanicas = sel.mecanicas.reduce((s, m) => s + (m.tipo === "cartas" ? (m.cartasFisicas ?? 0) : 0), 0);
  const cartasExtras = sel.extras.reduce((s, x) => s + (x.cartasFisicas ?? 0), 0);
  // Se imprimen las cartas que hay: los huecos de un pack mayor cobrado por ser más barato no
  // salen en blanco. Mientras falten para el mínimo, se cuenta el mínimo (es el mazo que se pagará).
  const cartasFisicas = Math.max(n, elegido.cartas) + CARTAS_PORTADA + cartasMecanicas + cartasExtras;
  const cajas = Math.max(1, Math.ceil(cartasFisicas / catalogo.caja.capacidadCartas));

  const lineas: LineaCotizacion[] = [{ tipo: "pack", id: aplicado.id, cantidad: 1, importeCents: aplicado.precioCents }];
  if (cartasExtra > 0) {
    lineas.push({ tipo: "cartas-extra", id: "cartas-extra", cantidad: cartasExtra, importeCents: cartasExtra * aplicado.precioCartaExtraCents });
  }
  if (cajas > 1) {
    lineas.push({ tipo: "caja", id: "caja", cantidad: cajas - 1, importeCents: (cajas - 1) * catalogo.caja.precioCajaExtraCents });
  }
  const baseMazo = lineas.reduce((s, l) => s + l.importeCents, 0);
  for (const m of sel.mecanicas) lineas.push({ tipo: "mecanica", id: m.id, cantidad: 1, importeCents: m.precioCents });
  for (const x of sel.extras) lineas.push({ tipo: "extra", id: x.id, cantidad: 1, importeCents: precioDeExtra(x, baseMazo) });
  lineas.push({ tipo: "envio", id: "envio", cantidad: 1, importeCents: 0 });

  const totalCents = lineas.reduce((s, l) => s + l.importeCents, 0);
  const excedeMaximo = n > catalogo.ampliacion.maxCartas;
  return {
    moneda: aplicado.moneda,
    pack: elegido,
    packAplicado: aplicado,
    cartas: n,
    minimo: elegido.cartas,
    faltan,
    cartasExtra,
    precioCartaExtraCents: aplicado.precioCartaExtraCents,
    cartasFisicas,
    cajas,
    lineas,
    totalCents,
    sePuedePagar: faltan === 0 && !excedeMaximo,
    excedeMaximo,
  };
}

/** Importe de un extra: fijo o un porcentaje del mazo (pack, cartas extra y cajas). */
export function precioDeExtra(x: Extra, baseMazoCents: number): number {
  return x.precio.tipo === "fijo" ? x.precio.cents : Math.round((baseMazoCents * x.precio.porcentaje) / 100);
}

/** Base del mazo de una cotización: lo que se usa para los extras en porcentaje. */
export function baseMazo(c: Pick<Cotizacion, "lineas">): number {
  return c.lineas.filter((l) => l.tipo === "pack" || l.tipo === "cartas-extra" || l.tipo === "caja").reduce((s, l) => s + l.importeCents, 0);
}

function seleccion(e: EntradaCotizacion): Seleccion {
  const { catalogo } = e;
  const extras = [...new Set(e.extras ?? [])].map((id) => {
    const x = catalogo.extras.find((c) => c.id === id && c.activo);
    if (!x) throw new ErrorCotizacion("extra-desconocido", id);
    return x;
  });
  const mecanicas = [...new Set(e.mecanicas ?? [])].map((id) => {
    const m = catalogo.mecanicas.find((c) => c.id === id && c.activo);
    if (!m) throw new ErrorCotizacion("mecanica-desconocida", id);
    return m;
  });
  return { extras, mecanicas };
}

/**
 * Calcula el precio de un mazo con los datos del catálogo. Todo en céntimos.
 * · El pack elegido marca el mínimo de cartas para pagar.
 * · Las cartas que pasan de las incluidas se cobran una a una al precio del pack aplicado.
 * · Si un pack mayor sale más barato, se cobra ese, tenga o no ya sus cartas: el precio nunca
 *   pasa del de un pack mayor ni baja al sumar cartas (con 53 cartas en el Pequeño se pagan los
 *   59 € del Mediano, no 59,40 €, y aún caben 7 más sin pagar nada).
 */
export function cotizar(e: EntradaCotizacion): Cotizacion {
  const { catalogo } = e;
  const elegido = catalogo.packs.find((p) => p.id === e.packId && p.activo);
  if (!elegido) throw new ErrorCotizacion("pack-desconocido", e.packId);
  if (!Number.isInteger(e.cartas) || e.cartas < 0) throw new ErrorCotizacion("cartas-invalidas", String(e.cartas));
  const sel = seleccion(e);
  const n = e.cartas;

  // Packs que se pueden cobrar: el elegido y los mayores.
  const candidatos = packsActivos(catalogo).filter((p) => p.id === elegido.id || p.cartas > elegido.cartas);
  let mejor = cotizarCon(catalogo, elegido, elegido, n, sel);
  for (const p of candidatos) {
    if (p.id === elegido.id) continue;
    const c = cotizarCon(catalogo, elegido, p, n, sel);
    if (c.totalCents < mejor.totalCents) mejor = c;
  }
  return { ...mejor, ofertas: ofertas(catalogo, elegido, mejor, sel) };
}

function ofertas(catalogo: Catalogo, elegido: Pack, actual: Omit<Cotizacion, "ofertas">, sel: Seleccion): Oferta[] {
  const lista: Oferta[] = [];
  const n = actual.cartas;
  const packs = packsActivos(catalogo);

  if (actual.packAplicado.id !== elegido.id) {
    const conElegido = cotizarCon(catalogo, elegido, elegido, n, sel);
    lista.push({
      tipo: "pack-aplicado",
      pack: actual.packAplicado,
      ahorroCents: conElegido.totalCents - actual.totalCents,
      huecos: Math.max(0, actual.packAplicado.cartas - n),
    });
  }

  if (actual.faltan > 0) {
    // Un pack menor que ya está cubierto con las cartas que hay.
    const menor = packs.filter((p) => p.cartas < elegido.cartas && p.cartas <= n).at(-1);
    if (menor) lista.push({ tipo: "bajar", pack: menor, totalCents: cotizarCon(catalogo, menor, menor, n, sel).totalCents });
    return lista;
  }

  // El siguiente pack mayor que el aplicado: ¿sale a cuenta llegar a él?
  const siguiente = packs.find((p) => p.cartas > Math.max(n, actual.packAplicado.cartas));
  if (siguiente && n < catalogo.ampliacion.maxCartas) {
    const cartasMas = siguiente.cartas - n;
    const conSiguiente = cotizarCon(catalogo, siguiente, siguiente, siguiente.cartas, sel);
    const diferenciaCents = conSiguiente.totalCents - actual.totalCents;
    // Lo que costaría sumar esas cartas una a una con el pack de ahora.
    const sueltas = cotizarCon(catalogo, elegido, actual.packAplicado, siguiente.cartas, sel).totalCents - actual.totalCents;
    const ahorroCents = sueltas - diferenciaCents;
    const cerca = cartasMas <= catalogo.ampliacion.ofertaMaxCartas;
    const aMitadDePrecio = diferenciaCents * 2 <= sueltas;
    if (ahorroCents > 0 && (diferenciaCents <= 0 || (cerca && aMitadDePrecio))) {
      lista.push({ tipo: "subir", pack: siguiente, cartasMas, diferenciaCents, ahorroCents });
    }
  }
  return lista;
}

/** Precio «desde» de un pack, para la portada. */
export function precioDesde(catalogo: Catalogo): { cents: number; moneda: string } | null {
  const activos = catalogo.packs.filter((p) => p.activo);
  if (activos.length === 0) return null;
  const min = activos.reduce((a, b) => (b.precioCents < a.precioCents ? b : a));
  return { cents: min.precioCents, moneda: min.moneda };
}

export function formatearImporte(cents: number, moneda: string, idioma: string): string {
  const entero = cents % 100 === 0;
  return new Intl.NumberFormat(idioma, {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Deja la selección de un mazo guardado en lo que el catálogo ofrece hoy: un pack activo y
 * solo extras y mecánicas activos. Sirve para borradores antiguos y para no mandar al pago
 * ids que el servidor rechazaría.
 */
export function normalizarSeleccion(
  sel: { packId: string; extras: string[]; mecanicas: string[] },
  catalogo: Catalogo,
): { packId: string; extras: string[]; mecanicas: string[]; cambiado: boolean } {
  const packActivo = catalogo.packs.some((p) => p.id === sel.packId && p.activo);
  const packId = packActivo ? sel.packId : (packPorDefecto(catalogo)?.id ?? sel.packId);
  const extras = [...new Set(sel.extras)].filter((id) => catalogo.extras.some((x) => x.id === id && x.activo));
  const mecanicas = [...new Set(sel.mecanicas)].filter((id) => catalogo.mecanicas.some((m) => m.id === id && m.activo));
  const cambiado = packId !== sel.packId || extras.length !== sel.extras.length || mecanicas.length !== sel.mecanicas.length;
  return { packId, extras, mecanicas, cambiado };
}
