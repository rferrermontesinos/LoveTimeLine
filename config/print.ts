/**
 * Formato de impresión. Provisional: se fija tras las pruebas de impresión.
 * Es el único sitio con medidas físicas; el resto del código las lee de aquí.
 */
export const PRINT = {
  /** Carta terminada (formato póker, el estándar de las imprentas de cartas a medida). */
  carta: { anchoMm: 63, altoMm: 88, radioEsquinaMm: 3 },
  /** Sangrado por cada lado. */
  sangradoMm: 3,
  /** Distancia mínima del texto importante al borde de corte. */
  zonaSeguraMm: 4,
  /** Resolución de salida de las caras rasterizadas. */
  ppp: 300,
  /** Por debajo de esta resolución efectiva se avisa y se pide confirmación, sin bloquear. */
  pppMinimo: 300,
  /** Medidas de las marcas de corte, en un margen fuera del sangrado. Cada imprenta dice si las quiere (IMPRENTAS). */
  marcasCorte: { margenMm: 6, largoMm: 4, separacionMm: 1, grosorPt: 0.25 },
  /** Compresión JPEG de cada cara en el PDF. */
  calidadJpeg: 0.92,
  /** Folleto de instrucciones: 4 × 2 paneles del tamaño de una carta, plegado en mapa. */
  folleto: { columnas: 4, filas: 2 },
  /** Lado mayor de la copia de trabajo de cada foto en el navegador. */
  ladoMaximoCopiaPx: 3200,
  /** Lado mayor de las miniaturas de la cuadrícula. */
  ladoMiniaturaPx: 480,
} as const;

export const MM_POR_PULGADA = 25.4;

/** Ancho entre alto de la carta cortada: la forma de las cartas y miniaturas de la web. */
export const PROPORCION_CARTA = PRINT.carta.anchoMm / PRINT.carta.altoMm;

/** Tamaño de una cara con sangrado, en milímetros. */
export function caraConSangradoMm() {
  return {
    ancho: PRINT.carta.anchoMm + 2 * PRINT.sangradoMm,
    alto: PRINT.carta.altoMm + 2 * PRINT.sangradoMm,
  };
}

/** Milímetros a píxeles a una resolución dada. */
export function mmAPx(mm: number, ppp: number = PRINT.ppp) {
  return (mm / MM_POR_PULGADA) * ppp;
}

/**
 * Lo que pide cada imprenta del archivo, según sus plantillas y sus correos (noviembre de 2026).
 * El diseño es el mismo para todas: cada perfil solo cambia el sangrado, las marcas de corte y
 * cómo se reparten las caras en páginas y archivos.
 */
export interface PerfilImprenta {
  /** Para el nombre del archivo y las pruebas. */
  id: string;
  /** Nombre de la imprenta. Sin nombre, es el archivo para cualquier otra («Otra imprenta»). */
  nombre: string | null;
  /**
   * Sangrado por cada lado. Las caras se dibujan con PRINT.sangradoMm: si la imprenta pide más,
   * el borde se amplía en espejo; si pide menos, se recorta.
   */
  sangradoMm: number;
  /** Marcas de corte en un margen alrededor de cada cara. */
  marcasCorte: boolean;
  /**
   * «intercaladas»: un PDF con cada carta seguida de su reverso. «separadas»: un PDF con las caras
   * y otro con los reversos, en el mismo orden, juntos en un ZIP. «pliegos»: un PDF con hojas de
   * varias cartas, montadas como las monta el programa de la imprenta (ver `pliego`).
   */
  paginas: "intercaladas" | "separadas" | "pliegos";
  /** Con «pliegos», cómo es la hoja. */
  pliego: PliegoImprenta | null;
  /** Bytes como mucho por página del PDF, si la imprenta pone límite. */
  maxBytesPagina: number | null;
  /** El color que pide. Los archivos salen en RGB (sRGB): de momento, a CMYK los pasa la imprenta. */
  color: "cmyk-fogra39" | "sin-especificar";
  /** Su guía dice que pasa a CMYK lo que le llega en RGB. */
  convierteRgb: boolean;
}

/**
 * Hoja con varias cartas, copiada del montaje del programa de la imprenta. Las medidas en mm van
 * desde la esquina de arriba a la izquierda del papel; las que van en pt son las del PDF, desde la
 * esquina de abajo a la izquierda.
 */
export interface PliegoImprenta {
  /** El programa cuyo montaje se copia. */
  programa: string;
  papel: { anchoMm: number; altoMm: number };
  columnas: number;
  filas: number;
  /**
   * Tamaño de corte de la imprenta. Si es algo mayor que la carta diseñada, lo que falta sale del
   * sangrado del diseño, sin escalar la carta.
   */
  corte: { anchoMm: number; altoMm: number };
  /** Sangrado de cada carta en la hoja, por cada lado. */
  sangradoMm: number;
  /** Separación entre cartas, de sangrado a sangrado. */
  separacionMm: number;
  /** Esquina de arriba a la izquierda de la primera carta, con su sangrado. */
  origenMm: { x: number; y: number };
  /** Líneas de corte: en los márgenes, desde el borde del papel hasta casi tocar el sangrado. */
  lineasCorte: { grosorPt: number; holguraPt: number };
  /** Lado de las dianas de registro de las cuatro esquinas. */
  dianaPt: number;
  /** Tira de control de color, arriba en el centro de la primera hoja. */
  tiraColor: { anchoPt: number; altoPt: number };
  /** Código del trabajo, abajo a la izquierda: el prefijo y la fecha y hora (aaaammddhhmmssmmm). */
  codigo: { prefijo: string; xPt: number; yPt: number };
  /** Número de hoja, abajo en el centro: «1» la cara y «1B» su trasera. */
  numero: { yPt: number; sufijoTrasera: string };
  /** Tamaño de la letra del código y del número (Helvetica, la del programa). */
  letraPt: number;
}

/**
 * La hoja de PNP Tool, el programa con el que Soriano monta las barajas: estilo «Copisteria
 * Soriano › Carta Estandar» de PNP Tool 20.9.10, medido en el PDF que generó con el mazo de prueba
 * (24-11-2026). A4 vertical con 3 × 3 cartas de 63,5 × 88,9 mm (2,5 × 3,5 pulgadas) y 1 mm de
 * sangrado, centradas; cada hoja va seguida de su trasera, con las columnas al revés para imprimir
 * a doble cara por el lado largo.
 */
export const PLIEGO_PNP_SORIANO: PliegoImprenta = {
  programa: "PNP Tool",
  papel: { anchoMm: 210, altoMm: 297 },
  columnas: 3,
  filas: 3,
  corte: { anchoMm: 63.5, altoMm: 88.9 },
  sangradoMm: 1,
  separacionMm: 2,
  origenMm: { x: 4.75, y: 10.15 },
  lineasCorte: { grosorPt: 1, holguraPt: 0.16 },
  dianaPt: 10,
  tiraColor: { anchoPt: 200, altoPt: 15 },
  codigo: { prefijo: "SO", xPt: 34.17, yPt: 13.54 },
  numero: { yPt: 17.71, sufijoTrasera: "B" },
  letraPt: 8,
};

export const IMPRENTAS: readonly PerfilImprenta[] = [
  // Plantilla «Póker 63x88» de tipia.es: al menos 4 mm de sangre, CMYK Coated FOGRA39 (mejor en
  // PDF/X-3), 300 ppp; un archivo con las caras y otro con los reversos, comprimidos.
  { id: "agr", nombre: "AGR · Tipia", sangradoMm: 4, marcasCorte: false, paginas: "separadas", pliego: null, maxBytesPagina: null, color: "cmyk-fogra39", convierteRgb: false },
  // Guía de pinbrogames.com/plantillas: escala 1:1, sin marcas de corte, cada carta seguida de su
  // reverso, 300 ppp, como mucho 3 MB por página; el RGB lo pasan a CMYK ellos.
  { id: "pinbro", nombre: "Pinbro", sangradoMm: 3, marcasCorte: false, paginas: "intercaladas", pliego: null, maxBytesPagina: 3_000_000, color: "cmyk-fogra39", convierteRgb: true },
  // La imprenta (24-11-2026): las barajas se montan con PNP Tool, y el archivo copia su hoja tal cual
  // (PLIEGO_PNP_SORIANO). Su correo del 17-11 pedía FOGRA39, pero su programa trabaja en RGB.
  { id: "soriano", nombre: "Soriano", sangradoMm: PLIEGO_PNP_SORIANO.sangradoMm, marcasCorte: true, paginas: "pliegos", pliego: PLIEGO_PNP_SORIANO, maxBytesPagina: null, color: "cmyk-fogra39", convierteRgb: true },
  // Para cualquier otra: el formato estándar de las imprentas de cartas.
  { id: "estandar", nombre: null, sangradoMm: PRINT.sangradoMm, marcasCorte: true, paginas: "intercaladas", pliego: null, maxBytesPagina: null, color: "sin-especificar", convierteRgb: false },
];

/**
 * Tamaño de cada página del PDF de una imprenta, en milímetros: la cara con su sangrado y, si lleva
 * marcas, su margen. Con pliegos, la página es el papel y la cara, la carta de la hoja con su sangrado.
 */
export function paginaImprenta(perfil: PerfilImprenta) {
  const h = perfil.pliego;
  if (h) {
    const cara = { ancho: h.corte.anchoMm + 2 * h.sangradoMm, alto: h.corte.altoMm + 2 * h.sangradoMm };
    return { ancho: h.papel.anchoMm, alto: h.papel.altoMm, margen: 0, cara };
  }
  const margen = perfil.marcasCorte ? PRINT.marcasCorte.margenMm : 0;
  const cara = { ancho: PRINT.carta.anchoMm + 2 * perfil.sangradoMm, alto: PRINT.carta.altoMm + 2 * perfil.sangradoMm };
  return { ancho: cara.ancho + 2 * margen, alto: cara.alto + 2 * margen, margen, cara };
}
