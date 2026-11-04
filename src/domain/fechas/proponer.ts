import { diferenciaDias, fechaDeInstante, rangoDias, type FechaCarta } from "./fecha";
import { fechaDesdeExif, type MetadatosFecha } from "./exif";
import { fechaDesdeNombre } from "./nombre-archivo";

export type FuenteFecha = "exif" | "nombre" | "archivo" | "manual";
export type Confianza = "alta" | "media" | "baja";

export type MotivoRevision =
  | "fecha-del-archivo"
  | "fecha-de-hoy"
  | "exif-y-nombre-no-coinciden"
  | "reloj-de-camara";

export interface PropuestaFecha {
  fecha: FechaCarta;
  fuente: FuenteFecha;
  confianza: Confianza;
  /** Las de confianza baja, o con señales contradictorias, quedan marcadas para revisar. */
  revisar: boolean;
  motivo?: MotivoRevision;
}

export interface EntradaPropuesta {
  nombreArchivo: string;
  exif?: MetadatosFecha | null;
  /** File.lastModified, en milisegundos. */
  ultimaModificacion?: number | null;
  hoy: Date;
}

/**
 * Propone la fecha de una foto en este orden: EXIF/XMP (alta), nombre del archivo (media)
 * y fecha de modificación del archivo como último recurso (baja, marcada para revisar).
 */
export function proponerFecha(e: EntradaPropuesta): PropuestaFecha | null {
  const deExif = fechaDesdeExif(e.exif, { hoy: e.hoy });
  const deNombre = fechaDesdeNombre(e.nombreArchivo, { hoy: e.hoy });

  if (deExif) {
    if (deExif.sospechosa) {
      if (deNombre) return { fecha: deNombre.fecha, fuente: "nombre", confianza: "media", revisar: false };
      return { fecha: deExif.fecha, fuente: "exif", confianza: "baja", revisar: true, motivo: "reloj-de-camara" };
    }
    // Si el nombre trae una fecha completa que no coincide (más de 2 días), lo señalamos.
    if (deNombre && deNombre.fecha.dia !== undefined && diferenciaDias(deExif.fecha, deNombre.fecha) > 2) {
      return { fecha: deExif.fecha, fuente: "exif", confianza: "media", revisar: true, motivo: "exif-y-nombre-no-coinciden" };
    }
    return { fecha: deExif.fecha, fuente: "exif", confianza: "alta", revisar: false };
  }

  if (deNombre) return { fecha: deNombre.fecha, fuente: "nombre", confianza: "media", revisar: false };

  if (e.ultimaModificacion !== undefined && e.ultimaModificacion !== null && Number.isFinite(e.ultimaModificacion)) {
    const fecha = fechaDeInstante(new Date(e.ultimaModificacion));
    const hoy = fechaDeInstante(e.hoy);
    if (rangoDias(fecha)[0] > rangoDias(hoy)[0]) return null;
    const reciente = rangoDias(hoy)[0] - rangoDias(fecha)[0] <= 2;
    return {
      fecha,
      fuente: "archivo",
      confianza: "baja",
      revisar: true,
      motivo: reciente ? "fecha-de-hoy" : "fecha-del-archivo",
    };
  }
  return null;
}
