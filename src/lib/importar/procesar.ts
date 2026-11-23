/**
 * Procesa cada foto en el navegador: huella SHA-256, fecha (EXIF/XMP/IPTC, nombre, archivo),
 * copia de trabajo y miniatura. Nada sale del dispositivo.
 */
import { PRINT } from "@config/print";
import { proponerFecha, type ResultadoFecha } from "@/domain/fechas/proponer";
import { limitarLado } from "@/domain/imagen/recorte";
import { crearLienzo } from "./lienzo";
import { leerMetadatos } from "./metadatos";

export interface FotoImportada {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  hash: string;
  copia: Blob;
  mini: Blob;
  ancho: number;
  alto: number;
  anchoOriginal: number;
  altoOriginal: number;
  /** Fecha segura (si la hay), sugerencias y por qué queda en blanco. Solo datos derivados. */
  propuesta: ResultadoFecha;
}

const EXTENSIONES = /\.(jpe?g|png|heic|heif|webp)$/i;
const TIPOS = /^image\/(jpeg|png|heic|heif|webp)$/i;

export function esImagenCompatible(f: File): boolean {
  return TIPOS.test(f.type) || EXTENSIONES.test(f.name);
}

function esHeic(f: File): boolean {
  return /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
}

async function huella(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Rutas de los archivos soltados con arrastrar y soltar (el navegador no las pone en el File). */
const rutasDeArrastre = new WeakMap<File, string>();

/**
 * Ruta del archivo dentro de la carpeta elegida o soltada («Escaneos/abuelos.jpg»), o solo su
 * nombre. Sirve para detectar carpetas de escaneos; no se guarda.
 */
export function rutaDe(archivo: File): string {
  return archivo.webkitRelativePath || rutasDeArrastre.get(archivo) || archivo.name;
}

async function decodificar(archivo: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch (e) {
    if (!esHeic(archivo)) throw e;
    // Chrome y Firefox no leen HEIC: se convierte a JPEG aquí mismo.
    const heic2any = (await import("heic2any")).default;
    const convertido = await heic2any({ blob: archivo, toType: "image/jpeg", quality: 0.92 });
    const blob = Array.isArray(convertido) ? convertido[0]! : convertido;
    return createImageBitmap(blob);
  }
}

async function reducir(bitmap: ImageBitmap, ladoMax: number, calidad: number) {
  const { ancho, alto } = limitarLado(bitmap.width, bitmap.height, ladoMax);
  const l = crearLienzo(ancho, alto);
  l.ctx.imageSmoothingQuality = "high";
  l.ctx.drawImage(bitmap, 0, 0, ancho, alto);
  return { blob: await l.aBlob("image/jpeg", calidad), ancho, alto };
}

export function nuevoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function procesarArchivo(archivo: File, hoy: Date): Promise<FotoImportada> {
  const buffer = await archivo.arrayBuffer();
  const [hash, exif] = await Promise.all([huella(buffer), leerMetadatos(buffer)]);
  const bitmap = await decodificar(archivo);
  try {
    const copia = await reducir(bitmap, PRINT.ladoMaximoCopiaPx, 0.9);
    const mini = await reducir(bitmap, PRINT.ladoMiniaturaPx, 0.82);
    return {
      id: nuevoId(),
      nombreArchivo: archivo.name,
      tipoArchivo: archivo.type || "image/jpeg",
      hash,
      copia: copia.blob,
      mini: mini.blob,
      ancho: copia.ancho,
      alto: copia.alto,
      anchoOriginal: bitmap.width,
      altoOriginal: bitmap.height,
      propuesta: proponerFecha({ nombreArchivo: archivo.name, rutaArchivo: rutaDe(archivo), exif, ultimaModificacion: archivo.lastModified, hoy }),
    };
  } finally {
    bitmap.close();
  }
}

/** Ejecuta tareas con un máximo en paralelo, avisando del progreso. */
export async function enCola<T, R>(
  elementos: T[],
  concurrencia: number,
  tarea: (x: T) => Promise<R>,
  alTerminar: (r: { ok: true; valor: R; entrada: T } | { ok: false; error: unknown; entrada: T }) => void,
): Promise<void> {
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < elementos.length) {
      const entrada = elementos[siguiente++]!;
      try {
        alTerminar({ ok: true, valor: await tarea(entrada), entrada });
      } catch (error) {
        alTerminar({ ok: false, error, entrada });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrencia, elementos.length)) }, trabajador));
}

/** Concurrencia razonable: menos en móviles para no agotar la memoria. */
export function concurrenciaRecomendada(): number {
  const nucleos = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  const movil = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return Math.max(1, Math.min(movil ? 2 : 4, nucleos - 1));
}

/** Recorre carpetas soltadas con arrastrar y soltar (webkitGetAsEntry). */
export async function archivosDeArrastre(dt: DataTransfer): Promise<File[]> {
  const items = [...dt.items].filter((i) => i.kind === "file");
  const entradas = items.map((i) => (typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null));
  if (entradas.every((e) => !e)) return [...dt.files];
  const archivos: File[] = [];
  const recorrer = async (entrada: FileSystemEntry): Promise<void> => {
    if (entrada.isFile) {
      const f = await new Promise<File>((ok, mal) => (entrada as FileSystemFileEntry).file(ok, mal));
      if (!f.webkitRelativePath && entrada.fullPath) rutasDeArrastre.set(f, entrada.fullPath.replace(/^\//, ""));
      archivos.push(f);
    } else if (entrada.isDirectory) {
      const lector = (entrada as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const lote = await new Promise<FileSystemEntry[]>((ok, mal) => lector.readEntries(ok, mal));
        if (lote.length === 0) break;
        for (const e of lote) await recorrer(e);
      }
    }
  };
  for (const e of entradas) if (e) await recorrer(e);
  return archivos;
}
