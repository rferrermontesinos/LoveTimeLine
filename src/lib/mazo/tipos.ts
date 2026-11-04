import type { FechaCarta } from "@/domain/fechas/fecha";
import type { Confianza, FuenteFecha, MotivoRevision } from "@/domain/fechas/proponer";
import type { Rect } from "@/domain/imagen/recorte";
import type { Adorno } from "@/lib/carta/tipos";
import type { Tono } from "@/lib/estilos";

/** Fecha posible que no se rellena sola porque no es segura. El cliente la acepta o pone otra. */
export interface SugerenciaFecha {
  fecha: FechaCarta;
  fuente: Exclude<FuenteFecha, "manual">;
  motivo?: MotivoRevision;
}

/** Lo que tiene toda carta de recuerdo, con foto o sin ella. */
export interface CartaBase {
  id: string;
  /** Obligatoria para pasar a Estilo y para pagar. */
  fecha: FechaCarta | null;
  fuente: FuenteFecha | null;
  confianza: Confianza | null;
  /** Fecha puesta sola en mazos antiguos que hay que confirmar. Las cartas nuevas no la usan. */
  revisar: boolean;
  /** Por qué la fecha está en blanco o hay que revisarla. */
  motivo?: MotivoRevision;
  /** Fechas posibles, la mejor primero. Nunca se ponen solas. */
  sugerencias?: SugerenciaFecha[];
  /** Frase de la carta: opcional con foto, obligatoria sin foto. Máximo 90 caracteres. */
  descripcion: string;
  /** Recuerdo estrella. */
  destacada: boolean;
  anadidaEn: number;
}

export interface CartaFoto extends CartaBase {
  tipo: "foto";
  nombreArchivo: string;
  tipoArchivo: string;
  /** SHA-256 del archivo original, para detectar fotos repetidas. */
  hash: string;
  /** Tamaño de la copia de trabajo guardada en el navegador. */
  ancho: number;
  alto: number;
  anchoOriginal: number;
  altoOriginal: number;
  descripcionEnAnverso: boolean;
  /** Recortes en píxeles de la copia de trabajo. */
  recorteAnverso: Rect;
  recorteReverso: Rect;
  /** Si el cliente ajustó el reverso a mano, ya no sigue al anverso. */
  reversoPersonalizado: boolean;
  adornos: Adorno[];
  pppConfirmado: boolean;
}

/** Recuerdo sin foto («El día que nos conocimos»): fecha y texto con el estilo del mazo. */
export interface CartaTexto extends CartaBase {
  tipo: "texto";
}

export type Carta = CartaFoto | CartaTexto;

export function esFoto(c: Carta): c is CartaFoto {
  return c.tipo === "foto";
}

export function esTexto(c: Carta): c is CartaTexto {
  return c.tipo === "texto";
}

/** Cambios que se pueden aplicar a una carta. En las de texto solo cuentan los campos comunes. */
export type CambiosCarta = Partial<Omit<CartaFoto, "id" | "tipo">>;

/**
 * Foto de la caja personalizada (extra de pago): una carta del mazo o una foto propia que no
 * es carta. La caja de siempre no lleva foto del cliente.
 */
export type FotoCaja =
  | { origen: "carta"; cartaId: string }
  | {
      origen: "propia";
      /** Id de la foto en el almacén del navegador (como las de las cartas). */
      id: string;
      nombreArchivo: string;
      tipoArchivo: string;
      hash: string;
      ancho: number;
      alto: number;
      anchoOriginal: number;
      altoOriginal: number;
      recorte: Rect;
    };

export type Paso = 1 | 2 | 3 | 4;

export interface Pedido {
  id: string;
  modo: "simulado" | "stripe";
  /** «pendiente» hasta que Stripe confirma el pago; los pedidos simulados nacen pagados. */
  estado: "pendiente" | "pagado";
  totalCents: number;
  moneda: string;
  cartasFisicas: number;
  fecha: number;
  stripeSessionId?: string;
}

export const VERSION_MAZO = 2;

export interface Mazo {
  version: typeof VERSION_MAZO;
  id: string;
  creadoEn: number;
  actualizadoEn: number;
  /** Pack elegido: marca el mínimo de cartas. */
  packId: string;
  estiloId: string;
  paletaId: string;
  titulo: string;
  dedicatoria: string;
  portadaId: string | null;
  /** Foto de la caja si se elige la caja personalizada; null = la foto de la portada. */
  caja: FotoCaja | null;
  tono: Tono;
  idiomaMazo: string;
  mecanicas: string[];
  extras: string[];
  /** Momento en que se aceptó el permiso para usar las fotos (RGPD). */
  consentimientoFotos: number | null;
  paso: Paso;
  cartas: Carta[];
  pedido: Pedido | null;
}

export type CampoMazo = "packId" | "estiloId" | "paletaId" | "titulo" | "dedicatoria" | "portadaId" | "tono" | "idiomaMazo" | "mecanicas" | "extras" | "paso";
