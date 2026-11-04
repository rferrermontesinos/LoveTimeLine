/**
 * Reparto de un texto en líneas y ajuste de su tamaño a una caja. Sin canvas: la medida del
 * texto se recibe como función, así que se puede probar sin navegador.
 */

/** Ancho de un texto en la unidad que use quien llama (px del lienzo, mm…). */
export type Medir = (texto: string) => number;

/**
 * Parte un texto en líneas que caben en un ancho. Una palabra más larga que la línea se corta
 * por caracteres. Si hay más líneas que el máximo, la última acaba en «…».
 */
export function partirLineas(texto: string, medir: Medir, anchoMax: number, maxLineas = Infinity): string[] {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  const cabe = (t: string) => medir(t) <= anchoMax;
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (cabe(prueba)) {
      actual = prueba;
      continue;
    }
    if (actual) lineas.push(actual);
    if (cabe(palabra)) {
      actual = palabra;
    } else {
      // Palabra más larga que la línea: se corta por caracteres.
      let trozo = "";
      for (const ch of palabra) {
        if (trozo && !cabe(trozo + ch)) {
          lineas.push(trozo);
          trozo = ch;
        } else trozo += ch;
      }
      actual = trozo;
    }
  }
  if (actual) lineas.push(actual);
  return recortar(lineas, cabe, maxLineas);
}

/** Deja las líneas máximas; la última acaba en «…» y cabe en el ancho. */
function recortar(lineas: string[], cabe: (t: string) => boolean, maxLineas: number): string[] {
  if (lineas.length <= maxLineas) return lineas;
  const cortadas = lineas.slice(0, Math.max(1, maxLineas));
  while (cortadas.length > 1 && cortadas.at(-1) === "") cortadas.pop();
  const i = cortadas.length - 1;
  let ultima = cortadas[i]!;
  while (ultima.length > 0 && !cabe(`${ultima}…`)) ultima = ultima.slice(0, -1).trimEnd();
  cortadas[i] = `${ultima}…`;
  return cortadas;
}

/**
 * Como `partirLineas`, pero respeta los saltos de línea del texto (la dedicatoria los tiene):
 * cada párrafo empieza en una línea nueva y una línea vacía entre párrafos se queda (solo una).
 */
export function partirParrafos(texto: string, medir: Medir, anchoMax: number, maxLineas = Infinity): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.trim().split("\n")) {
    const partidas = partirLineas(parrafo, medir, anchoMax);
    if (partidas.length) lineas.push(...partidas);
    else if (lineas.length && lineas.at(-1) !== "") lineas.push("");
  }
  return recortar(lineas, (t) => medir(t) <= anchoMax, maxLineas);
}

/** ¿Alguna palabra no cabe entera en la línea y habría que cortarla? */
function cortaPalabras(texto: string, medir: Medir, anchoMax: number): boolean {
  return texto
    .trim()
    .split(/\s+/)
    .some((p) => p && medir(p) > anchoMax);
}

export interface EntradaAjuste {
  texto: string;
  /** Mide el texto a un tamaño de letra dado (misma unidad que anchoMax). */
  medir: (texto: string, tamano: number) => number;
  anchoMax: number;
  altoMax: number;
  tamanoMax: number;
  tamanoMin: number;
  /** Alto de cada línea en tamaños de letra (1 = el tamaño de la letra). */
  interlineado: number;
  lineasMax: number;
  /** Paso entre tamaños probados. */
  paso?: number;
}

export interface Ajuste {
  tamano: number;
  lineas: string[];
  /** Alto que ocupa el bloque: líneas × tamaño × interlineado. */
  alto: number;
  /** El texto no cabía ni al tamaño mínimo y se ha recortado con «…». */
  recortado: boolean;
}

/**
 * Busca el tamaño de letra más grande con el que el texto cabe en la caja sin partir palabras,
 * sin pasar de las líneas máximas ni del alto. Si no cabe ni al mínimo, usa el mínimo y recorta.
 * Respeta los saltos de línea del texto.
 */
export function ajustarTexto(e: EntradaAjuste): Ajuste {
  const paso = e.paso ?? 0.1;
  const texto = e.texto.trim();
  if (!texto) return { tamano: e.tamanoMax, lineas: [], alto: 0, recortado: false };
  for (let t = e.tamanoMax; t >= e.tamanoMin - 1e-9; t = Math.round((t - paso) * 1000) / 1000) {
    const medir: Medir = (s) => e.medir(s, t);
    if (cortaPalabras(texto, medir, e.anchoMax)) continue;
    const lineas = partirParrafos(texto, medir, e.anchoMax);
    const alto = lineas.length * t * e.interlineado;
    if (lineas.length <= e.lineasMax && alto <= e.altoMax + 1e-9) return { tamano: t, lineas, alto, recortado: false };
  }
  const t = e.tamanoMin;
  const maxPorAlto = Math.max(1, Math.floor((e.altoMax + 1e-9) / (t * e.interlineado)));
  const lineas = partirParrafos(texto, (s) => e.medir(s, t), e.anchoMax, Math.min(e.lineasMax, maxPorAlto));
  const completo = partirParrafos(texto, (s) => e.medir(s, t), e.anchoMax);
  return { tamano: t, lineas, alto: lineas.length * t * e.interlineado, recortado: completo.length > lineas.length || lineas.join(" ") !== completo.join(" ") };
}
