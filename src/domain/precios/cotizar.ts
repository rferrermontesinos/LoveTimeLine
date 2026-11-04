import type { Catalogo, Pack } from "./tipos";

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
  packId: string;
  /** Cartas con foto del mazo. */
  cartasFoto: number;
  extras?: string[];
  mecanicas?: string[];
}

export type TipoLinea = "pack" | "ampliacion" | "caja" | "extra" | "mecanica" | "envio";

export interface LineaCotizacion {
  tipo: TipoLinea;
  /** Id del pack, extra o mecánica; «ampliacion», «caja» o «envio» en el resto. */
  id: string;
  cantidad: number;
  importeCents: number;
}

export interface Cotizacion {
  moneda: string;
  pack: Pack;
  cartasFoto: number;
  /** Mínimo jugable: las cartas del pack. */
  minimo: number;
  faltan: number;
  bloquesAmpliacion: number;
  /** Cartas con foto que caben en lo pagado. */
  plazas: number;
  /** Plazas pagadas en la última ampliación que aún no tienen foto. */
  huecosLibres: number;
  /** Cartas impresas: fotos + portada + cartas de mecánicas y extras. */
  cartasFisicas: number;
  cajas: number;
  lineas: LineaCotizacion[];
  totalCents: number;
  sePuedePagar: boolean;
  excedeMaximo: boolean;
}

/** Carta de portada con el título y la dedicatoria: va siempre incluida. */
export const CARTAS_PORTADA = 1;

/**
 * Calcula el precio de un mazo con los datos del catálogo. Todo en céntimos.
 * El pack incluye un número de cartas (mínimo jugable); las que pasan se cobran por bloques.
 */
export function cotizar(e: EntradaCotizacion): Cotizacion {
  const { catalogo } = e;
  const pack = catalogo.packs.find((p) => p.id === e.packId && p.activo);
  if (!pack) throw new ErrorCotizacion("pack-desconocido", e.packId);
  if (!Number.isInteger(e.cartasFoto) || e.cartasFoto < 0) throw new ErrorCotizacion("cartas-invalidas", String(e.cartasFoto));

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

  const { bloqueCartas, precioBloqueCents, maxCartasFoto } = catalogo.ampliacion;
  const faltan = Math.max(0, pack.cartas - e.cartasFoto);
  const sobrantes = Math.max(0, e.cartasFoto - pack.cartas);
  const bloquesAmpliacion = Math.ceil(sobrantes / bloqueCartas);
  const plazas = pack.cartas + bloquesAmpliacion * bloqueCartas;
  const huecosLibres = e.cartasFoto >= pack.cartas ? plazas - e.cartasFoto : 0;

  const cartasMecanicas = mecanicas.reduce((s, m) => s + (m.tipo === "cartas" ? (m.cartasFisicas ?? 0) : 0), 0);
  const cartasExtras = extras.reduce((s, x) => s + (x.cartasFisicas ?? 0), 0);
  const cartasFisicas = Math.max(e.cartasFoto, pack.cartas) + CARTAS_PORTADA + cartasMecanicas + cartasExtras;
  const cajas = Math.max(1, Math.ceil(cartasFisicas / catalogo.caja.capacidadCartas));

  const lineas: LineaCotizacion[] = [{ tipo: "pack", id: pack.id, cantidad: 1, importeCents: pack.precioCents }];
  if (bloquesAmpliacion > 0) {
    lineas.push({ tipo: "ampliacion", id: "ampliacion", cantidad: bloquesAmpliacion, importeCents: bloquesAmpliacion * precioBloqueCents });
  }
  if (cajas > 1) {
    lineas.push({ tipo: "caja", id: "caja", cantidad: cajas - 1, importeCents: (cajas - 1) * catalogo.caja.precioCajaExtraCents });
  }
  const baseMazo = lineas.reduce((s, l) => s + l.importeCents, 0);
  for (const m of mecanicas) lineas.push({ tipo: "mecanica", id: m.id, cantidad: 1, importeCents: m.precioCents });
  for (const x of extras) {
    const importe = x.precio.tipo === "fijo" ? x.precio.cents : Math.round((baseMazo * x.precio.porcentaje) / 100);
    lineas.push({ tipo: "extra", id: x.id, cantidad: 1, importeCents: importe });
  }
  lineas.push({ tipo: "envio", id: "envio", cantidad: 1, importeCents: 0 });

  const totalCents = lineas.reduce((s, l) => s + l.importeCents, 0);
  const excedeMaximo = e.cartasFoto > maxCartasFoto;
  return {
    moneda: pack.moneda,
    pack,
    cartasFoto: e.cartasFoto,
    minimo: pack.cartas,
    faltan,
    bloquesAmpliacion,
    plazas,
    huecosLibres,
    cartasFisicas,
    cajas,
    lineas,
    totalCents,
    sePuedePagar: faltan === 0 && !excedeMaximo,
    excedeMaximo,
  };
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
