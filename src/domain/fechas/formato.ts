import { precisionDe, type FechaCarta } from "./fecha";

/** Abreviaturas de mes para la carta cuando Intl no da una forma corta limpia. */
const ABREVIATURAS: Record<string, string[]> = {
  ca: ["GEN", "FEB", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OCT", "NOV", "DES"],
};

/** Etiqueta de mes de 3 letras en mayúsculas para la carta, según el idioma del mazo. */
export function etiquetaMesCarta(mes: number, idioma: string): string {
  const base = idioma.split("-")[0]!.toLowerCase();
  const tabla = ABREVIATURAS[base];
  if (tabla) return tabla[mes - 1]!;
  const texto = new Intl.DateTimeFormat(idioma, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2001, mes - 1, 15)));
  return texto
    .replace(/[.\s]/g, "")
    .normalize("NFC")
    .slice(0, 3)
    .toLocaleUpperCase(idioma);
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
