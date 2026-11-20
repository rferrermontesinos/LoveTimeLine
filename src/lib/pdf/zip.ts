/**
 * ZIP mínimo y sin comprimir: lo justo para entregar varios archivos en uno, como piden algunas
 * imprentas. Los PDF ya van comprimidos por dentro (las caras son JPEG), así que comprimirlos otra
 * vez apenas ahorraría nada.
 */

export interface ArchivoZip {
  /** Nombre dentro del ZIP (UTF-8). */
  nombre: string;
  bytes: Uint8Array;
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (el de ZIP y PNG). */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fecha y hora en el formato de MS-DOS que usa el ZIP (de 2 en 2 segundos, desde 1980). */
function fechaDos(d: Date): { hora: number; fecha: number } {
  const anio = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    fecha: ((anio - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const UTF8 = 0x0800;
const VERSION = 20;

/** Junta los archivos en un ZIP sin comprimir. Cada archivo, como mucho 4 GB (sin ZIP64). */
export function crearZip(archivos: ArchivoZip[], fecha: Date = new Date()): Uint8Array {
  const codificador = new TextEncoder();
  const { hora, fecha: dia } = fechaDos(fecha);
  const partes: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const a of archivos) {
    const nombre = codificador.encode(a.nombre);
    const crc = crc32(a.bytes);
    const tam = a.bytes.length;

    const local = new Uint8Array(30 + nombre.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, VERSION, true);
    l.setUint16(6, UTF8, true);
    l.setUint16(8, 0, true); // sin comprimir
    l.setUint16(10, hora, true);
    l.setUint16(12, dia, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, tam, true);
    l.setUint32(22, tam, true);
    l.setUint16(26, nombre.length, true);
    local.set(nombre, 30);
    partes.push(local, a.bytes);

    const central = new Uint8Array(46 + nombre.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, VERSION, true);
    c.setUint16(6, VERSION, true);
    c.setUint16(8, UTF8, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, tam, true);
    c.setUint32(24, tam, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    central.set(nombre, 46);
    centrales.push(central);

    desplazamiento += local.length + tam;
  }

  const tamCentral = centrales.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, archivos.length, true);
  f.setUint16(10, archivos.length, true);
  f.setUint32(12, tamCentral, true);
  f.setUint32(16, desplazamiento, true);

  const todo = [...partes, ...centrales, fin];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of todo) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}

/**
 * Lee un ZIP sin comprimir como los de crearZip, desde su directorio central. Es para las pruebas:
 * el portal no abre archivos ZIP.
 */
export function leerZip(zip: Uint8Array): { nombre: string; bytes: Uint8Array; crc: number }[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fin = zip.byteLength - 22;
  if (v.getUint32(fin, true) !== 0x06054b50) throw new Error("No es un ZIP (o lleva comentario)");
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const salida = [];
  for (let i = 0; i < total; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Directorio central dañado");
    if (v.getUint16(p + 10, true) !== 0) throw new Error("Archivo comprimido: solo se leen ZIP sin comprimir");
    const crc = v.getUint32(p + 16, true);
    const tam = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    if (v.getUint32(local, true) !== 0x04034b50) throw new Error("Cabecera local dañada");
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    salida.push({ nombre: new TextDecoder().decode(zip.subarray(p + 46, p + 46 + largoNombre)), bytes: zip.subarray(inicio, inicio + tam), crc });
    p += 46 + largoNombre + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return salida;
}
