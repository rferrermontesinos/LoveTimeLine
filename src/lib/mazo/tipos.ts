import type { FechaCarta } from "@/domain/fechas/fecha";
import type { Confianza, FuenteFecha, MotivoRevision } from "@/domain/fechas/proponer";
import type { Rect } from "@/domain/imagen/recorte";
import type { Adorno } from "@/lib/carta/tipos";
import type { Tono } from "@/lib/estilos";

export interface Carta {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  /** SHA-256 del archivo original, para detectar fotos repetidas. */
  hash: string;
  /** Tamaño de la copia de trabajo guardada en el navegador. */
  ancho: number;
  alto: number;
  anchoOriginal: number;
  altoOriginal: number;
  fecha: FechaCarta | null;
  fuente: FuenteFecha | null;
  confianza: Confianza | null;
  revisar: boolean;
  motivo?: MotivoRevision;
  descripcion: string;
  descripcionEnAnverso: boolean;
  /** Recortes en píxeles de la copia de trabajo. */
  recorteAnverso: Rect;
  recorteReverso: Rect;
  /** Si el cliente ajustó el reverso a mano, ya no sigue al anverso. */
  reversoPersonalizado: boolean;
  destacada: boolean;
  adornos: Adorno[];
  pppConfirmado: boolean;
  anadidaEn: number;
}

export type Paso = 1 | 2 | 3 | 4;

export interface Pedido {
  id: string;
  modo: "simulado" | "stripe";
  totalCents: number;
  moneda: string;
  fecha: number;
  stripeSessionId?: string;
}

export interface Mazo {
  version: 1;
  id: string;
  creadoEn: number;
  actualizadoEn: number;
  packId: string;
  estiloId: string;
  tintaId: string;
  titulo: string;
  dedicatoria: string;
  portadaId: string | null;
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

export type CampoMazo = "packId" | "estiloId" | "tintaId" | "titulo" | "dedicatoria" | "portadaId" | "tono" | "idiomaMazo" | "mecanicas" | "extras" | "paso";
