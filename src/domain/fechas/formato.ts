import { precisionDe, type FechaCarta } from "./fecha";

/** Abreviaturas de mes para la carta cuando Intl no da una forma corta limpia. */
const ABREVIATURAS: Record<string, string[]> = {
  ca: ["GEN", "FEB", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OCT", "NOV", "DES"],
};

/** Las etiquetas de los 12 meses de cada idioma, ya calculadas. */
const ETIQUETAS = new Map<string, string[]>();

/**
 * Etiqueta de mes en mayúsculas para la carta, según el idioma del mazo: 3 letras, o las que hagan
 * falta para que dos meses no se confundan en un juego de ordenar fechas (en francés, junio y julio
 * serían «JUI» los dos: quedan «JUIN» y «JUIL»).
 */
export function etiquetaMesCarta(mes: number, idioma: string): string {
  const base = idioma.split("-")[0]!.toLowerCase();
  const tabla = ABREVIATURAS[base];
  if (tabla) return tabla[mes - 1]!;
  let etiquetas = ETIQUETAS.get(idioma);
  if (!etiquetas) {
    const formato = new Intl.DateTimeFormat(idioma, { month: "short", timeZone: "UTC" });
    const nombres = Array.from({ length: 12 }, (_, i) =>
      formato
        .format(new Date(Date.UTC(2001, i, 15)))
        .replace(/[.\s]/g, "")
        .normalize("NFC"),
    );
    const prefijo = (n: string, largo: number) => n.slice(0, largo).toLocaleUpperCase(idioma);
    etiquetas = nombres.map((n, i) => {
      let largo = 3;
      while (largo < n.length && nombres.some((otro, j) => j !== i && prefijo(otro, largo) === prefijo(n, largo))) largo++;
      return prefijo(n, largo);
    });
    ETIQUETAS.set(idioma, etiquetas);
  }
  return etiquetas[mes - 1]!;
}

/** Lo que muestra el reverso: el año grande y una línea con día y mes, mes solo, o nada. */
export function textoFechaCarta(f: FechaCarta, idioma: string): { anio: string; linea: string } {
  const anio = String(f.anio);
  if (f.mes === undefined) return { anio, linea: "" };
  const mes = etiquetaMesCarta(f.mes, idioma);
  return { anio, linea: f.dia === undefined ? mes : `${f.dia} ${mes}` };
}

/** Fecha legible en la interfaz, en el idioma del usuario y con su precisión. */
export function fechaLegible(f: FechaCarta, idioma: string): string {
  const p = precisionDe(f);
  if (p === "anio") return String(f.anio);
  const d = new Date(Date.UTC(f.anio, (f.mes ?? 1) - 1, f.dia ?? 1));
  const opciones: Intl.DateTimeFormatOptions =
    p === "mes" ? { month: "long", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(idioma, opciones).format(d);
}

/** Versión compacta para miniaturas y listas («22 dic 2009», «dic 2009», «2009»). */
export function fechaCorta(f: FechaCarta, idioma: string): string {
  const p = precisionDe(f);
  if (p === "anio") return String(f.anio);
  const d = new Date(Date.UTC(f.anio, (f.mes ?? 1) - 1, f.dia ?? 1));
  const opciones: Intl.DateTimeFormatOptions =
    p === "mes" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(idioma, opciones).format(d).replace(/\.(?=\s|$)/g, "");
}

/** Nombres de los 12 meses en el idioma del usuario, para los selectores. */
export function nombresMeses(idioma: string): string[] {
  const fmt = new Intl.DateTimeFormat(idioma, { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2001, i, 15))));
}
