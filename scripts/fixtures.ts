/**
 * Genera fotos de prueba sintéticas (formas de colores, sin personas) en tests/fixtures/generadas/.
 * Los nombres siguen los patrones que el portal reconoce, para probar la lectura de fechas.
 * Aparte, en la subcarpeta escaner/, unas pocas «de escáner» y «fotos de fotos» con fechas
 * relativas al día en que se generan, para probar que esas fechas no se rellenan solas.
 * Nunca uses fotos reales en los tests.
 *
 *   pnpm fixtures                 → 42 fotos (lo justo para el pack pequeño y un poco más) y escaner/
 *   pnpm fixtures 60              → otra cantidad
 *   pnpm fixtures 62 salidas/fotos → en otra carpeta (los tests usan la de por defecto)
 */
import { mkdir, rm, utimes } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SALIDA = path.resolve(process.argv[3] ?? path.join("tests", "fixtures", "generadas"));
const COLORES = ["#F7739E", "#22A861", "#E8402F", "#FFC93C", "#2E56E6", "#141414", "#EDE6D8", "#B8205F", "#11733F"];

/** Pseudoaleatorio determinista: mismas fotos en cada ejecución. */
function azar(semilla: number) {
  let s = semilla * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function svg(i: number, ancho: number, alto: number): string {
  const r = azar(i + 1);
  const fondo = COLORES[i % COLORES.length]!;
  const formas = Array.from({ length: 7 }, (_, k) => {
    const color = COLORES[Math.floor(r() * COLORES.length)]!;
    const x = Math.round(r() * ancho);
    const y = Math.round(r() * alto);
    const radio = Math.round((0.08 + r() * 0.28) * Math.min(ancho, alto));
    return k % 2
      ? `<circle cx="${x}" cy="${y}" r="${radio}" fill="${color}" opacity="0.85"/>`
      : `<rect x="${x - radio}" y="${y - radio / 2}" width="${radio * 2}" height="${radio}" rx="${radio / 5}" fill="${color}" opacity="0.8"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fondo}"/><stop offset="1" stop-color="#F5F0E6"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${formas}</svg>`;
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Fecha y hora con el formato de EXIF («2019:08:14 18:30:00»), en hora local. */
const fechaExif = (d: Date) =>
  `${d.getFullYear()}:${dos(d.getMonth() + 1)}:${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
/** «20261101», como en los nombres de cámara y de escáner. */
const fechaCompacta = (d: Date) => `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}`;

/** Nombre de archivo con una fecha en alguno de los formatos habituales. */
function nombre(i: number): { nombre: string; exif?: string } {
  const anio = 2008 + (i % 18);
  const mes = 1 + ((i * 5) % 12);
  const dia = 1 + ((i * 7) % 28);
  const f = `${anio}${dos(mes)}${dos(dia)}`;
  switch (i % 8) {
    case 0:
      return { nombre: `IMG_${f}_${dos(10 + (i % 12))}3015.jpg` };
    case 1:
      return { nombre: `PXL_${f}_1830${dos(i % 60)}123.jpg` };
    case 2:
      return { nombre: `IMG-${f}-WA${String(i).padStart(4, "0")}.jpg` };
    case 3:
      return { nombre: `${anio}-${dos(mes)}-${dos(dia)} excursion ${i}.jpg` };
    case 4:
      return { nombre: `Screenshot_${anio}-${dos(mes)}-${dos(dia)}-12-00-${dos(i % 60)}.png` };
    case 5:
      return { nombre: `verano ${anio} (${i}).jpg` };
    case 6:
      // Fecha solo en los metadatos EXIF, de una cámara: se rellena sola.
      return { nombre: `DSC${String(1000 + i).padStart(5, "0")}.jpg`, exif: `${anio}:${dos(mes)}:${dos(dia)} 18:30:00` };
    default:
      // Sin fecha en el nombre ni en EXIF: el portal sugiere la fecha del archivo, sin ponerla.
      return { nombre: `foto-${i}.jpg` };
  }
}

type Etiquetas = Record<string, string>;
interface FotoEscaner {
  nombre: string;
  ifd0?: Etiquetas;
  /** Bloque EXIF, con los nombres de libexif (DateTimeOriginal, DateTimeDigitized). */
  ifd2?: Etiquetas;
  modificada: Date;
}

const ESCANER_PLANO: Etiquetas = { Make: "EPSON", Model: "Perfection V600", Software: "EPSON Scan" };
const ESCANER_FOTOS: Etiquetas = { Make: "EPSON", Model: "FastFoto FF-680W", Software: "Epson FastFoto" };
const MOVIL: Etiquetas = { Make: "Prueba", Model: "Sintetica" };

/** Escaneos y fotos de fotos antiguas, con fechas recientes respecto a `hoy`. */
function fotosDeEscaner(hoy: Date): FotoEscaner[] {
  const hace = (dias: number, segundos = 0) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias, 10, 15, segundos);
  const escaneo = hace(3);
  const sesion = hace(2);
  return [
    // Escáner plano, solo con la fecha del escaneo: en blanco y sin sugerencias («parece escaneada»).
    { nombre: "escaneo-001.jpg", ifd0: ESCANER_PLANO, ifd2: { DateTimeDigitized: fechaExif(escaneo) }, modificada: escaneo },
    // Escaneada, pero con el año escrito por una persona en el nombre: se rellena (1958).
    { nombre: "abuelos 1958.jpg", ifd0: ESCANER_PLANO, ifd2: { DateTimeDigitized: fechaExif(escaneo) }, modificada: escaneo },
    // Escáner de fotos que guarda la fecha original anotada: se sugiere el 14 de junio de 1987.
    {
      nombre: "boda tios.jpg",
      ifd0: ESCANER_FOTOS,
      ifd2: { DateTimeOriginal: "1987:06:14 12:00:00", DateTimeDigitized: fechaExif(escaneo) },
      modificada: escaneo,
    },
    // Nombre que pone Google Drive al escanear: ni fecha ni sugerencia.
    { nombre: `Scanned_${fechaCompacta(hace(5))}-1000.jpg`, modificada: hace(5) },
    // Cinco fotos de fotos hechas con el móvil el mismo día: fecha reciente sugerida y aviso de
    // «parece una sesión de escaneo».
    ...Array.from({ length: 5 }, (_, k): FotoEscaner => {
      const momento = hace(2, k * 7);
      return {
        nombre: `IMG_${fechaCompacta(sesion)}_1015${dos(k * 7)}.jpg`,
        ifd0: MOVIL,
        ifd2: { DateTimeOriginal: fechaExif(momento), DateTimeDigitized: fechaExif(momento) },
        modificada: momento,
      };
    }),
  ];
}

async function generarEscaner(carpeta: string) {
  await mkdir(carpeta, { recursive: true });
  const fotos = fotosDeEscaner(new Date());
  for (const [k, f] of fotos.entries()) {
    const [ancho, alto] = k % 2 ? [1800, 1200] : [1200, 1800];
    // Colores apagados, como una copia en papel antigua.
    let img = sharp(Buffer.from(svg(100 + k, ancho, alto))).modulate({ saturation: 0.35 });
    if (f.ifd0 || f.ifd2) img = img.withExif({ ...(f.ifd0 ? { IFD0: f.ifd0 } : {}), ...(f.ifd2 ? { IFD2: f.ifd2 } : {}) });
    const destino = path.join(carpeta, f.nombre);
    await img.jpeg({ quality: 82 }).toFile(destino);
    await utimes(destino, f.modificada, f.modificada);
  }
  return fotos.length;
}

async function main() {
  const cantidad = Number(process.argv[2] ?? 42);
  await rm(SALIDA, { recursive: true, force: true });
  await mkdir(SALIDA, { recursive: true });
  for (let i = 0; i < cantidad; i++) {
    const vertical = i % 3 === 0;
    const [ancho, alto] = vertical ? [1500, 2000] : [2000, 1500];
    const { nombre: archivo, exif } = nombre(i);
    let img = sharp(Buffer.from(svg(i, ancho, alto)));
    const destino = path.join(SALIDA, archivo);
    if (archivo.endsWith(".png")) {
      await img.png().toFile(destino);
    } else {
      // IFD2 es el bloque EXIF; las etiquetas van con los nombres de libexif (DateTimeDigitized, no CreateDate).
      if (exif) img = img.withExif({ IFD0: MOVIL, IFD2: { DateTimeOriginal: exif, DateTimeDigitized: exif } });
      await img.jpeg({ quality: 82 }).toFile(destino);
    }
    // Fecha de modificación fija para las fotos sin fecha, para que el test sea estable.
    const fija = new Date(Date.UTC(2023, 5, 1 + (i % 20), 12));
    await utimes(destino, fija, fija);
  }
  const escaner = await generarEscaner(path.join(SALIDA, "escaner"));
  console.log(`${cantidad} fotos sintéticas en ${path.relative(process.cwd(), SALIDA)} y ${escaner} de escáner en escaner/`);
}

void main();
