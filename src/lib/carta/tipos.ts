import type { FechaCarta } from "@/domain/fechas/fecha";
import type { Rect } from "@/domain/imagen/recorte";
import type { Estilo, Plantilla, Tinta, Tono } from "@/lib/estilos";

export type Cara = "anverso" | "reverso";
export type TipoCarta = "foto" | "portada" | "comodin" | "en-blanco" | "reto" | "caja";

/** Emoji colocado sobre la cara de la foto. Posición y tamaño relativos a la carta terminada. */
export interface Adorno {
  id: string;
  emoji: string;
  /** Centro, de 0 a 1 sobre el ancho y el alto de la carta. */
  x: number;
  y: number;
  /** Tamaño como fracción del ancho de la carta. */
  tamano: number;
  /** Giro en grados. */
  giro: number;
}

export interface FotoCarta {
  imagen: CanvasImageSource;
  /** Píxeles de esta imagen por píxel de la copia de trabajo (los recortes están en la copia). */
  escala: number;
  recorteAnverso: Rect;
  recorteReverso: Rect;
}

export interface DatosCarta {
  tipo: TipoCarta;
  foto?: FotoCarta | null;
  fecha?: FechaCarta | null;
  descripcion?: string;
  descripcionEnAnverso?: boolean;
  /** Icono de mecánica en el hueco de la pestaña: «estrella», «bocadillo»… */
  icono?: string | null;
  adornos?: Adorno[];
  titulo?: string;
  subtitulo?: string;
  dedicatoria?: string;
  /** Texto de una carta de reto. */
  texto?: string;
}

/** Textos impresos en las cartas, en el idioma del mazo. */
export interface TextosCarta {
  pregunta: string;
  comodin: string;
  comodinRegla: string;
  enBlancoFoto: string;
  enBlancoFrase: string;
  enBlancoFecha: string;
  reto: string;
  portadaReverso: string;
  marca: string;
}

export interface OpcionesDibujo {
  plantilla: Plantilla;
  estilo: Estilo;
  tinta: Tinta;
  tono: Tono;
  /** Idioma del mazo (meses de la carta). */
  idioma: string;
  textos: TextosCarta;
  /** Dibuja el sangrado alrededor (impresión). Sin sangrado, la carta se ve como quedará cortada. */
  conSangrado: boolean;
  pxPorMm: number;
  /** Recorta las esquinas redondeadas (solo pantalla). */
  redondear?: boolean;
  /** Muestra la zona segura con una línea discontinua. */
  guias?: boolean;
}
