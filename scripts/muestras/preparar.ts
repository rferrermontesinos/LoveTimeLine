/**
 * Prepara las fotos de muestra de la web (cartas de ejemplo y mesa de «Cómo se juega») a partir
 * de las originales de Pexels, que no entran en el repositorio:
 *
 *   pnpm exec tsx scripts/muestras/preparar.ts /ruta/a/fotos-muestra/
 *
 * La carpeta de origen trae las originales y su creditos.json (autor, página y licencia). Cada
 * foto elegida (scripts/muestras/seleccion.ts) se recorta a la proporción de la carta (63:88) con
 * su encuadre, se reduce, se le quitan todos los metadatos (EXIF, XMP, ICC, C2PA) y se guarda como
 * JPEG progresivo de menos de 250 KB en public/muestras/. La mesa sale ligera en public/juego/,
 * apaisada y en vertical para el móvil. También escribe public/muestras/creditos.json, que es lo
 * que enseñan el pie y la página de privacidad. Con las mismas originales y la misma versión de
 * sharp, el resultado es siempre el mismo.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Sharp } from "sharp";
import { PRINT } from "../../config/print";
import { problemasJpeg } from "./jpeg";
import { medidasSalida, recorteMuestra } from "./recorte";
import { ALTO_MUESTRA, DESCARTADAS, MAX_BYTES_MUESTRA, MESA, MINI, SALIDAS_MESA, SELECCION, type TextoI18n } from "./seleccion";

/** Proporción de la carta terminada (ancho/alto). */
const PROPORCION = PRINT.carta.anchoMm / PRINT.carta.altoMm;
/** Calidades que se prueban, de mejor a peor, hasta que el archivo cabe en su límite. */
const CALIDADES = [84, 80, 76, 72, 68, 64, 60];

const RAIZ = process.cwd();
const DESTINO_MUESTRAS = path.join(RAIZ, "public", "muestras");
const DESTINO_MESA = path.join(RAIZ, "public", "juego");

interface CreditoOrigen {
  archivo: string;
  fotografo: string;
  pagina: string;
  licencia: string;
}

interface CreditosOrigen {
  licencia: { nombre: string; url: string };
  fotos: CreditoOrigen[];
  mesa: CreditoOrigen;
}

/** Lo que se publica en public/muestras/creditos.json. */
export interface CreditoMuestra {
  id: string;
  /** Rutas públicas de los archivos que salen de esta foto. */
  archivos: string[];
  fotografo: string;
  pagina: string;
  descripcion: TextoI18n;
}

/** JPEG progresivo sin metadatos que cabe en `maxBytes`, con la mejor calidad posible. */
async function jpegLigero(imagen: Sharp, maxBytes: number): Promise<{ datos: Buffer; calidad: number }> {
  for (const calidad of CALIDADES) {
    // sharp no copia ningún metadato salvo que se le pida (withMetadata/keepMetadata).
    const datos = await imagen.clone().jpeg({ quality: calidad, progressive: true, mozjpeg: true }).toBuffer();
    if (datos.length <= maxBytes) return { datos, calidad };
  }
  throw new Error(`No cabe en ${maxBytes} bytes ni con calidad ${CALIDADES.at(-1)}`);
}

/**
 * El archivo escrito no lleva metadatos y es progresivo. Se recorren sus segmentos con una lista
 * blanca (jpeg.ts) en vez de fiarse de lo que sharp dice conservar: así, si otra versión u otras
 * opciones de sharp dejaran un segmento nuevo (un manifiesto C2PA en APP11, por ejemplo), no se
 * publicaría sin verlo.
 */
function comprobar(datos: Buffer, nombre: string) {
  const problemas = problemasJpeg(datos);
  if (problemas.length) throw new Error(`${nombre}: ${problemas.join("; ")}`);
}

async function main() {
  const origen = process.argv[2];
  if (!origen) {
    console.error("Uso: pnpm exec tsx scripts/muestras/preparar.ts <carpeta con las originales y creditos.json>");
    process.exit(1);
  }
  const creditos = JSON.parse(await readFile(path.join(origen, "creditos.json"), "utf8")) as CreditosOrigen;
  const credito = (archivo: string): CreditoOrigen => {
    const c = creditos.fotos.find((f) => f.archivo === archivo) ?? (creditos.mesa.archivo === archivo ? creditos.mesa : undefined);
    if (!c) throw new Error(`${archivo} no está en creditos.json`);
    if (c.licencia !== creditos.licencia.nombre) throw new Error(`${archivo}: licencia inesperada (${c.licencia})`);
    return c;
  };

  await mkdir(path.join(DESTINO_MUESTRAS, MINI.carpeta), { recursive: true });
  await mkdir(DESTINO_MESA, { recursive: true });
  const publicados: CreditoMuestra[] = [];
  const { ancho, alto } = medidasSalida(PROPORCION, ALTO_MUESTRA);

  for (const f of SELECCION) {
    const c = credito(f.archivo);
    // rotate() sin ángulo aplica la orientación EXIF antes de medir y recortar.
    const girada = await sharp(path.join(origen, f.archivo)).rotate().toBuffer();
    const { width = 0, height = 0 } = await sharp(girada).metadata();
    const caja = recorteMuestra(width, height, PROPORCION, f.encuadre);
    const imagen = sharp(girada).extract(caja).resize(ancho, alto, { fit: "fill", kernel: "lanczos3" });
    const { datos, calidad } = await jpegLigero(imagen, MAX_BYTES_MUESTRA);
    comprobar(datos, f.id);
    await writeFile(path.join(DESTINO_MUESTRAS, `${f.id}.jpg`), datos);
    console.log(`${f.id}.jpg  ${ancho}×${alto}  ${(datos.length / 1024).toFixed(0)} KB  calidad ${calidad}  recorte ${caja.width}×${caja.height}+${caja.left}+${caja.top}`);

    // La ligera sale de la grande ya recortada: mismo encuadre, menos píxeles.
    const mini = medidasSalida(PROPORCION, MINI.alto);
    const ligera = await jpegLigero(sharp(datos).resize(mini.ancho, mini.alto, { fit: "fill", kernel: "lanczos3" }), MINI.maxBytes);
    comprobar(ligera.datos, `${MINI.carpeta}/${f.id}`);
    await writeFile(path.join(DESTINO_MUESTRAS, MINI.carpeta, `${f.id}.jpg`), ligera.datos);

    publicados.push({
      id: f.id,
      archivos: [`/muestras/${f.id}.jpg`, `/muestras/${MINI.carpeta}/${f.id}.jpg`],
      fotografo: c.fotografo,
      pagina: c.pagina,
      descripcion: f.descripcion,
    });
  }

  const cm = credito(MESA.archivo);
  const archivosMesa: string[] = [];
  for (const s of SALIDAS_MESA) {
    const imagen = sharp(path.join(origen, MESA.archivo)).rotate().resize(s.ancho, s.alto, { fit: "cover", position: "centre" });
    const { datos, calidad } = await jpegLigero(imagen, s.maxBytes);
    comprobar(datos, s.nombre);
    await writeFile(path.join(DESTINO_MESA, s.nombre), datos);
    console.log(`${s.nombre}  ${s.ancho}×${s.alto}  ${(datos.length / 1024).toFixed(0)} KB  calidad ${calidad}`);
    archivosMesa.push(`/juego/${s.nombre}`);
  }
  publicados.push({ id: MESA.id, archivos: archivosMesa, fotografo: cm.fotografo, pagina: cm.pagina, descripcion: MESA.descripcion });

  const json = {
    $comentario: "Generado por scripts/muestras/preparar.ts a partir de las originales de Pexels. No lo edites a mano.",
    fuente: "Pexels",
    licencia: { nombre: creditos.licencia.nombre, url: creditos.licencia.url },
    fotos: publicados,
  };
  await writeFile(path.join(DESTINO_MUESTRAS, "creditos.json"), `${JSON.stringify(json, null, 2)}\n`);
  console.log(`creditos.json con ${publicados.length} fotos. Descartadas: ${DESCARTADAS.map((d) => d.archivo).join(", ")}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
