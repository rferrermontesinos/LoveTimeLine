import { ANIO_MINIMO, crearFecha, esFutura, type FechaCarta } from "./fecha";

/**
 * Metadatos de fecha tal como los devuelve el lector EXIF/XMP sin convertir (cadenas).
 * EXIF: "2019:08:14 12:30:45". XMP: "2019-08-14T12:30:45+02:00" o "2019-08-14".
 */
export interface MetadatosFecha {
  DateTimeOriginal?: string | Date;
  CreateDate?: string | Date;
  DateTimeDigitized?: string | Date;
  /** XMP: photoshop:DateCreated o xmp:CreateDate */
  DateCreated?: string | Date;
}

export interface FechaDesdeExif {
  fecha: FechaCarta;
  campo: keyof MetadatosFecha;
  /** Fecha típica de un reloj de cámara sin configurar: se propone, pero conviene revisarla. */
  sospechosa: boolean;
}

const ORDEN: (keyof MetadatosFecha)[] = ["DateTimeOriginal", "CreateDate", "DateTimeDigitized", "DateCreated"];

/** Fechas que ponen las cámaras con el reloj sin configurar. */
const POR_DEFECTO = new Set(["1970-01-01", "1980-01-01", "2000-01-01", "2001-01-01", "2002-01-01"]);

/** Lee la parte de fecha literalmente, sin aplicar zonas horarias (evita saltos de día). */
export function leerFechaMetadato(valor: string | Date | undefined): FechaCarta | null {
  if (valor === undefined || valor === null) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return crearFecha(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  }
  const m = /^\s*(\d{4})[:\-/](\d{2})[:\-/](\d{2})/.exec(String(valor));
  if (m) return crearFecha(Number(m[1]), Number(m[2]), Number(m[3]));
  const soloAnioMes = /^\s*(\d{4})-(\d{2})\s*$/.exec(String(valor));
  if (soloAnioMes) return crearFecha(Number(soloAnioMes[1]), Number(soloAnioMes[2]));
  const soloAnio = /^\s*(\d{4})\s*$/.exec(String(valor));
  if (soloAnio) return crearFecha(Number(soloAnio[1]));
  return null;
}

export function fechaDesdeExif(meta: MetadatosFecha | null | undefined, opciones: { hoy: Date }): FechaDesdeExif | null {
  if (!meta) return null;
  for (const campo of ORDEN) {
    const f = leerFechaMetadato(meta[campo]);
    if (!f || f.anio < ANIO_MINIMO || esFutura(f, opciones.hoy)) continue;
    const iso = `${f.anio}-${String(f.mes ?? 1).padStart(2, "0")}-${String(f.dia ?? 1).padStart(2, "0")}`;
    if (iso === "1970-01-01" || iso === "1980-01-01") continue;
    return { fecha: f, campo, sospechosa: POR_DEFECTO.has(iso) };
  }
  return null;
}
