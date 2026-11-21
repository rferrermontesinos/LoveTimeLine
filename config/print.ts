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
   * y otro con los reversos, en el mismo orden, juntos en un ZIP.
   */
  paginas: "intercaladas" | "separadas";
  /** Bytes como mucho por página del PDF, si la imprenta pone límite. */
  maxBytesPagina: number | null;
  /** El color que pide. Los archivos salen en RGB (sRGB): de momento, a CMYK los pasa la imprenta. */
  color: "cmyk-fogra39" | "sin-especificar";
  /** Su guía dice que pasa a CMYK lo que le llega en RGB. */
  convierteRgb: boolean;
}

export const IMPRENTAS: readonly PerfilImprenta[] = [
  // Plantilla «Póker 63x88» de tipia.es: al menos 4 mm de sangre, CMYK Coated FOGRA39 (mejor en
  // PDF/X-3), 300 ppp; un archivo con las caras y otro con los reversos, comprimidos.
  { id: "agr", nombre: "AGR · Tipia", sangradoMm: 4, marcasCorte: false, paginas: "separadas", maxBytesPagina: null, color: "cmyk-fogra39", convierteRgb: false },
  // Guía de pinbrogames.com/plantillas: escala 1:1, sin marcas de corte, cada carta seguida de su
  // reverso, 300 ppp, como mucho 3 MB por página; el RGB lo pasan a CMYK ellos.
  { id: "pinbro", nombre: "Pinbro", sangradoMm: 3, marcasCorte: false, paginas: "intercaladas", maxBytesPagina: 3_000_000, color: "cmyk-fogra39", convierteRgb: true },
  // Correo de la imprenta (17-11-2026): carta a carta, 2 mm de sangrado, marcas de corte, 300 ppp, FOGRA39.
  { id: "soriano", nombre: "Soriano", sangradoMm: 2, marcasCorte: true, paginas: "intercaladas", maxBytesPagina: null, color: "cmyk-fogra39", convierteRgb: false },
  // Para cualquier otra: el formato estándar de las imprentas de cartas.
  { id: "estandar", nombre: null, sangradoMm: PRINT.sangradoMm, marcasCorte: true, paginas: "intercaladas", maxBytesPagina: null, color: "sin-especificar", convierteRgb: false },
];

/** Tamaño de cada página del PDF de una imprenta, en milímetros: la cara con su sangrado y, si lleva marcas, su margen. */
export function paginaImprenta(perfil: PerfilImprenta) {
  const margen = perfil.marcasCorte ? PRINT.marcasCorte.margenMm : 0;
  const cara = { ancho: PRINT.carta.anchoMm + 2 * perfil.sangradoMm, alto: PRINT.carta.altoMm + 2 * perfil.sangradoMm };
  return { ancho: cara.ancho + 2 * margen, alto: cara.alto + 2 * margen, margen, cara };
}
