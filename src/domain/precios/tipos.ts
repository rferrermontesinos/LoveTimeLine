/** Textos del catálogo por idioma: { es: "...", en: "..." }. */
export type TextoI18n = Record<string, string>;

export interface Pack {
  id: string;
  orden: number;
  activo: boolean;
  /** Cartas con foto incluidas: es también el mínimo jugable para poder pagar. */
  cartas: number;
  precioCents: number;
  moneda: string;
  estiloPorDefecto: string;
  nombre: TextoI18n;
  descripcion: TextoI18n;
}

export type PrecioExtra =
  | { tipo: "fijo"; cents: number }
  /** Porcentaje sobre el mazo (pack, ampliaciones y cajas). */
  | { tipo: "porcentajeMazo"; porcentaje: number };

export interface Extra {
  id: string;
  orden: number;
  activo: boolean;
  precio: PrecioExtra;
  /** Cartas físicas que añade al mazo (por ejemplo, el pack de retos). */
  cartasFisicas?: number;
  nombre: TextoI18n;
  descripcion: TextoI18n;
}

export interface Mecanica {
  id: string;
  orden: number;
  activo: boolean;
  /** «icono»: se imprime en el hueco reservado de algunas cartas. «cartas»: añade cartas especiales. */
  tipo: "icono" | "cartas";
  icono?: string;
  asignacion?: "manual" | "automatica";
  maxCartas?: number;
  cadaN?: number;
  cartasFisicas?: number;
  porDefecto: boolean;
  precioCents: number;
  nombre: TextoI18n;
  descripcion: TextoI18n;
}

export interface Pais {
  codigo: string;
  activo: boolean;
  moneda: string;
  envioIncluido: boolean;
  diasEntrega: { min: number; max: number };
}

export interface Catalogo {
  version: number;
  moneda: string;
  paises: Pais[];
  packs: Pack[];
  ampliacion: { bloqueCartas: number; precioBloqueCents: number; maxCartasFoto: number };
  caja: { capacidadCartas: number; precioCajaExtraCents: number };
  extras: Extra[];
  mecanicas: Mecanica[];
}

export function textoEn(t: TextoI18n, idioma: string, alternativo = "es"): string {
  return t[idioma] ?? t[idioma.split("-")[0]!] ?? t[alternativo] ?? Object.values(t)[0] ?? "";
}
