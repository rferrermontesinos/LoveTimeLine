import naipe from "../../styles/plantillas/naipe.json";
import estiloNaipe from "../../styles/naipe/style.json";
import { CONTRASTE_GRAFICO, contraste } from "@/domain/color/contraste";
import type { TextoI18n } from "@/domain/precios/tipos";

/** Paleta de color que elige el cliente. */
export interface Paleta {
  id: string;
  nombre: TextoI18n;
  /** Color de las pestañas de las esquinas y del fondo del reverso. */
  fondo: string;
  /** Segundo color de la paleta: detalles de las caras sin foto (carta de texto, comodín). */
  acento: string;
  /** Color del texto sobre el fondo (contraste ≥ 4.5:1). */
  texto: string;
}

export interface ColoresEstilo {
  /** Negro de la tinta: hueco de los iconos, fondos oscuros y texto sobre papel. */
  tinta: string;
  /** Crema del papel: fondos claros y texto sobre tinta. */
  papel: string;
  /** Color del velo de las fotos, en «r, g, b». */
  velo: string;
}

export interface Estilo {
  id: string;
  version: number;
  plantilla: string;
  nombre: TextoI18n;
  descripcion: TextoI18n;
  paletaPorDefecto: string;
  paletas: Paleta[];
  colores: ColoresEstilo;
}

export type Tono = "original" | "bn" | "calido";
export const TONOS: Tono[] = ["original", "bn", "calido"];

export type RolFuente = "titular" | "texto" | "micro" | "normal";

/** Icono de la esquina: ruta SVG en una caja de 24 × 24, o la ruta con su regla de relleno. */
export type IconoPlantilla = string | { d: string; regla?: string };

/** Zona rectangular dentro de la carta (o del panel que la contiene), medida desde cada borde (mm). */
export interface Zona {
  izquierda: number;
  derecha: number;
  arriba: number;
  abajo: number;
}

/** Texto que se ajusta solo: del tamaño máximo al mínimo hasta que cabe, sin partir palabras. */
interface TamanoAjustable {
  tamanoMaximo: number;
  tamanoMinimo: number;
  /** Alto de cada línea en tamaños de letra. */
  interlineado: number;
  lineasMaximas: number;
}

/** Texto ajustable dentro de una zona, con el bloque centrado o apoyado abajo. */
export interface TextoEnZona extends TamanoAjustable {
  zona: Zona;
  alineacion: "centro" | "abajo";
}

/**
 * Geometría de una familia de cartas. Todas las medidas en milímetros sobre la carta terminada
 * (el sangrado se añade fuera). Los valores salen de styles/plantillas/<id>.json.
 */
export interface Plantilla {
  id: string;
  version: number;
  fuentes: Record<RolFuente, { familia: string; url: string; peso: number }>;
  pestana: {
    ancho: number;
    alto: number;
    radio: number;
    margenSuperior: number;
    margenIzquierdo: number;
    tamanoValorAnverso: number;
    tamanoValorReverso: number;
    separacion: number;
    /** Círculo del icono; `glifo` es el lado del icono en radios del círculo. */
    hueco: { diametro: number; trazo: number; visibleSinMecanica: boolean; glifo: number };
  };
  anverso: {
    veloIzquierdo: { ancho: number; opacidad: number };
    veloDescripcion: { ancho: number; opacidad: number };
    descripcion: { derecha: number; arriba: number; altoMaximo: number; tamano: number; interlineado: number };
    pregunta: { izquierda: number; abajo: number; tamano: number; espaciado: number };
  };
  reverso: {
    /** Alto de la foto del reverso (o del panel que ocupa su sitio), desde el borde superior. */
    altoFoto: number;
    descripcion: { arriba: number; lateral: number; tamano: number; interlineado: number; lineasMaximas: number };
    anio: { izquierda: number; abajo: number; tamano: number; espaciado: number };
    diaMes: { derecha: number; abajo: number; tamano: number };
  };
  /** Trazo corto de color sobre los textos de las caras sin foto. */
  marca: { ancho: number; alto: number; separacion: number };
  /**
   * Carta de texto. En el anverso, la zona se mide sobre la carta; en el reverso, sobre el panel
   * que ocupa el sitio de la foto (de arriba a `reverso.altoFoto`).
   */
  texto: { anverso: TextoEnZona; reverso: TextoEnZona };
  portada: {
    banda: number;
    margen: number;
    /** Título del mazo en la banda; `altoMaximo` es lo que puede ocupar el bloque. */
    titulo: TamanoAjustable & { arriba: number; altoMaximo: number };
    subtitulo: { abajo: number; tamano: number; espaciado: number };
    dedicatoria: TamanoAjustable & { arriba: number; alto: number; radio: number; relleno: number };
    jugar: { arriba: number; tamano: number; espaciado: number; interlineado: number; lineasMaximas: number };
    anios: { abajo: number; tamano: number };
  };
  caja: {
    marca: { arriba: number; tamano: number; espaciado: number };
    pregunta: { arriba: number; tamano: number; interlineado: number; lineasMaximas: number };
    texto: { arriba: number; tamano: number; interlineado: number; lineasMaximas: number };
    /** Cara de la caja de siempre: el nombre de la marca como el texto de una carta sin foto. */
    generica: {
      nombre: TamanoAjustable & { zona: Zona };
      lema: { tamano: number; interlineado: number; separacion: number; lineasMaximas: number };
    };
  };
  comodin: {
    anverso: { centroArte: number; tamanoArte: number; titulo: { abajo: number; tamano: number } };
    reverso: {
      centroArte: number;
      tamanoArte: number;
      titulo: { arriba: number; tamano: number };
      regla: TamanoAjustable & { arriba: number; abajo: number };
    };
  };
  enBlanco: {
    anverso: {
      zona: Zona & { radio: number; trazo: number; guion: number[] };
      aviso: { tamano: number; espaciado: number; interlineado: number };
    };
    reverso: {
      /** Etiqueta y líneas para escribir la frase, en el panel de arriba. */
      frase: { arriba: number; tamano: number; espaciado: number; lineas: number[]; trazo: number };
      casillas: {
        arriba: number;
        abajo: number;
        separacion: number;
        /** Parte del ancho útil para la casilla del año; el resto, para el día y el mes. */
        proporcionAnio: number;
        radio: number;
        etiqueta: { tamano: number; espaciado: number; margen: number };
      };
    };
  };
  tonosFoto: Record<Tono, { filtro: string }>;
  iconos: Record<string, IconoPlantilla>;
}

/**
 * El tipo de un JSON con `never` en cada clave que su tipo `T` no conoce, a cualquier
 * profundidad (también dentro de las listas). En un `Record<string, …>` vale cualquier clave,
 * y las que empiezan por «$» son comentarios. Asignar el JSON a este tipo no compila si le sobra
 * algo: TypeScript no lo comprueba solo cuando el objeto viene de un import o de un `...`.
 */
type SinClavesDeMas<T, U> = U extends readonly (infer E)[]
  ? T extends readonly (infer F)[]
    ? SinClavesDeMas<F, E>[]
    : U
  : U extends object
    ? string extends keyof T
      ? U
      : { [K in keyof U]: K extends `$${string}` ? U[K] : K extends keyof T ? SinClavesDeMas<T[K], U[K]> : never }
    : U;

/** La alineación del JSON llega como texto: se acepta solo si es una de las conocidas. */
function esAlineacion(valor: string): valor is TextoEnZona["alineacion"] {
  return valor === "centro" || valor === "abajo";
}
function aAlineacion(valor: string): TextoEnZona["alineacion"] {
  if (esAlineacion(valor)) return valor;
  throw new Error(`Alineación desconocida en la plantilla: ${valor}`);
}

/**
 * Los JSON se comprueban contra su tipo al compilar: un campo que falte, que sobre o que tenga
 * otro tipo no compila. Sin `as`: la alineación se estrecha con su guarda, que también falla al
 * cargar si el valor no es uno de los conocidos.
 */
const naipeSinSobrantes: SinClavesDeMas<Plantilla, typeof naipe> = naipe;
const naipeTipada: Plantilla = {
  ...naipeSinSobrantes,
  texto: {
    anverso: { ...naipe.texto.anverso, alineacion: aAlineacion(naipe.texto.anverso.alineacion) },
    reverso: { ...naipe.texto.reverso, alineacion: aAlineacion(naipe.texto.reverso.alineacion) },
  },
};
const PLANTILLAS: Record<string, Plantilla> = { naipe: naipeTipada };

const estiloNaipeSinSobrantes: SinClavesDeMas<Estilo, typeof estiloNaipe> = estiloNaipe;

/**
 * Estilos activos. Hoy hay uno («naipe») con varias paletas: el cliente elige la paleta, no el
 * estilo. Añadir uno = crear styles/<id>/style.json, comprobarlo como este y sumarlo aquí.
 */
export const ESTILOS: Estilo[] = [estiloNaipeSinSobrantes];
export const ESTILO_POR_DEFECTO: Estilo = ESTILOS[0]!;

export function obtenerEstilo(id: string | null | undefined): Estilo {
  return ESTILOS.find((e) => e.id === id) ?? ESTILO_POR_DEFECTO;
}

export function obtenerPaleta(estilo: Estilo, paletaId: string | null | undefined): Paleta {
  return estilo.paletas.find((p) => p.id === paletaId) ?? estilo.paletas.find((p) => p.id === estilo.paletaPorDefecto) ?? estilo.paletas[0]!;
}

export function obtenerPlantilla(id: string): Plantilla {
  const p = PLANTILLAS[id];
  if (!p) throw new Error(`Plantilla desconocida: ${id}`);
  return p;
}

/** Ruta y regla de relleno de un icono de la plantilla, o null si la plantilla no lo tiene. */
export function rutaIcono(plantilla: Pick<Plantilla, "iconos">, icono: string | null | undefined): { d: string; regla: CanvasFillRule } | null {
  const def = icono ? plantilla.iconos[icono] : undefined;
  if (!def) return null;
  if (typeof def === "string") return { d: def, regla: "nonzero" };
  return { d: def.d, regla: def.regla === "evenodd" ? "evenodd" : "nonzero" };
}

/**
 * Color del icono dentro del hueco (un círculo de tinta): el color de la paleta, salvo que no
 * se distinga de la tinta (paleta «noche»), y entonces el papel.
 */
export function colorGlifo(paleta: Pick<Paleta, "fondo">, colores: Pick<ColoresEstilo, "tinta" | "papel">): string {
  return contraste(paleta.fondo, colores.tinta) >= CONTRASTE_GRAFICO ? paleta.fondo : colores.papel;
}

/** Colores de las caras sin foto (carta de texto, comodín): fondo neutro, texto y un detalle. */
export interface Superficie {
  fondo: string;
  texto: string;
  /** Detalles gráficos (trazo sobre el texto, dibujo del comodín). */
  acento: string;
}

/**
 * Las caras sin foto no pueden usar el color de la paleta de fondo: la pestaña de la esquina
 * desaparecería. Usan la tinta y, si la pestaña no se distingue de ella (paleta «noche»), el papel.
 * El detalle es el acento de la paleta si se ve sobre ese fondo; si no, el color de la paleta.
 */
export function superficie(paleta: Paleta, colores: Pick<ColoresEstilo, "tinta" | "papel">): Superficie {
  const oscura = contraste(paleta.fondo, colores.tinta) >= CONTRASTE_GRAFICO;
  const fondo = oscura ? colores.tinta : colores.papel;
  const texto = oscura ? colores.papel : colores.tinta;
  const candidatos = [paleta.acento, paleta.fondo];
  const acento = candidatos.find((c) => contraste(c, fondo) >= CONTRASTE_GRAFICO) ?? texto;
  return { fondo, texto, acento };
}
