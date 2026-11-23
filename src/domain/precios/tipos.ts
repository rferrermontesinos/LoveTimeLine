/** Textos del catálogo por idioma: { es: "...", en: "..." }. */
export type TextoI18n = Record<string, string>;

/**
 * Pack por tamaño de mazo. Las cartas incluidas son el mínimo para pagar si eliges ese pack;
 * las que pasan se cobran una a una al precio de carta extra del pack que se aplica.
 */
export interface Pack {
  id: string;
  orden: number;
  activo: boolean;
  /** Cartas de recuerdo incluidas (con foto o de texto). */
  cartas: number;
  precioCents: number;
  /** Precio de cada carta que pasa de las incluidas. */
  precioCartaExtraCents: number;
  moneda: string;
  nombre: TextoI18n;
  /** Para quién es, en una frase corta: «Ideal para parejas». */
  claim: TextoI18n;
  descripcion: TextoI18n;
}

export type PrecioExtra =
  | { tipo: "fijo"; cents: number }
  /** Porcentaje sobre el mazo (pack, cartas extra y cajas). */
  | { tipo: "porcentajeMazo"; porcentaje: number };

/** Lo que cambia un extra en el mazo, además de cobrarse. */
export type EfectoExtra = "caja-personalizada";

export interface Extra {
  id: string;
  orden: number;
  activo: boolean;
  precio: PrecioExtra;
  /** Cartas físicas que añade al mazo. */
  cartasFisicas?: number;
  efecto?: EfectoExtra;
  nombre: TextoI18n;
  descripcion: TextoI18n;
}

export interface Mecanica {
  id: string;
  orden: number;
  activo: boolean;
  /** «icono»: se imprime en el hueco de la esquina de algunas cartas. «cartas»: añade cartas especiales. */
  tipo: "icono" | "cartas";
  /** Icono de la esquina (id de styles/plantillas/<plantilla>.json → iconos). */
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
  ampliacion: {
    /** Máximo de cartas de recuerdo por mazo. */
    maxCartas: number;
    /** Cuántas cartas por debajo de un pack mayor empieza a avisarse de la oferta. */
    ofertaMaxCartas: number;
  };
  caja: { capacidadCartas: number; precioCajaExtraCents: number };
  extras: Extra[];
  mecanicas: Mecanica[];
}

export function textoEn(t: TextoI18n, idioma: string, alternativo = "es"): string {
  return t[idioma] ?? t[idioma.split("-")[0]!] ?? t[alternativo] ?? Object.values(t)[0] ?? "";
}
