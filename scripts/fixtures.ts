/**
 * Genera fotos de prueba sintéticas (formas de colores, sin personas) en tests/fixtures/generadas/.
 * Los nombres siguen los patrones que el portal reconoce, para probar la lectura de fechas.
 * Nunca uses fotos reales en los tests.
 *
 *   pnpm fixtures        → 42 fotos (lo justo para el pack Pareja y un poco más)
 *   pnpm fixtures 60     → otra cantidad
 */
import { mkdir, rm, utimes } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SALIDA = path.join(process.cwd(), "tests", "fixtures", "generadas");
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
      // Fecha solo en los metadatos EXIF.
      return { nombre: `DSC${String(1000 + i).padStart(5, "0")}.jpg`, exif: `${anio}:${dos(mes)}:${dos(dia)} 18:30:00` };
    default:
      // Sin fecha en el nombre ni en EXIF: el portal usará la fecha del archivo y pedirá revisarla.
      return { nombre: `foto-${i}.jpg` };
  }
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
      if (exif) img = img.withExif({ IFD0: { Make: "Prueba", Model: "Sintetica" }, IFD2: { DateTimeOriginal: exif, CreateDate: exif } });
      await img.jpeg({ quality: 82 }).toFile(destino);
    }
    // Fecha de modificación fija para las fotos sin fecha, para que el test sea estable.
    const fija = new Date(Date.UTC(2023, 5, 1 + (i % 20), 12));
    await utimes(destino, fija, fija);
  }
  console.log(`${cantidad} fotos sintéticas en ${path.relative(process.cwd(), SALIDA)}`);
}

void main();
