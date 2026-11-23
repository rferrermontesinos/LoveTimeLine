import type { FechaCarta } from "@/domain/fechas/fecha";
import type { Rect } from "@/domain/imagen/recorte";
import type { Estilo, Plantilla, Paleta, Tono } from "@/lib/estilos";

export type Cara = "anverso" | "reverso";
export type TipoCarta = "foto" | "texto" | "portada" | "comodin" | "en-blanco" | "caja";

/**
 * Caja del mazo. La genérica es el packaging de stock (solo la marca, nunca va en el archivo de
 * impresión del pedido); la personalizada es el extra de pago, con una foto y el título del mazo.
 */
export type VarianteCaja = "generica" | "personalizada";

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
  /** Icono de la esquina (id de la plantilla: «estrella», «comodin», «en-blanco»…), en el hueco de la pestaña. */
  icono?: string | null;
  adornos?: Adorno[];
  titulo?: string;
  subtitulo?: string;
  dedicatoria?: string;
  /** Texto del recuerdo de una carta sin foto. */
  texto?: string;
  /** Solo para la caja: explícita, porque una foto nula también es una foto que aún está cargando. */
  variante?: VarianteCaja;
}

/** Textos impresos en las cartas, en el idioma del mazo. */
export interface TextosCarta {
  pregunta: string;
  comodin: string;
  comodinRegla: string;
  enBlancoFoto: string;
  enBlancoFrase: string;
  enBlancoAnio: string;
  enBlancoDiaMes: string;
  portadaReverso: string;
  dedicatoriaPorDefecto: string;
  cajaTexto: string;
  cajaLema: string;
  marca: string;
}

export interface OpcionesDibujo {
  plantilla: Plantilla;
  estilo: Estilo;
  paleta: Paleta;
  tono: Tono;
  /** Idioma del mazo (meses y textos de la carta). */
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
