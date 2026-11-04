/**
 * Genera un PDF de impresión de muestra con datos ficticios, recorriendo el portal como lo
 * haría un cliente: empieza en Fotos con el pack elegido, sube fotos sintéticas (las de
 * `pnpm fixtures`), acepta las fechas sugeridas, añade un recuerdo sin foto, escribe la frase de
 * una carta, pone título y dedicatoria, pide la caja personalizada (con la foto de la portada),
 * paga en modo simulado y descarga el archivo de impresión. Así la muestra lleva todo lo que se
 * imprime: texto detrás de la portada, frases, cartas de texto y la caja. El PDF queda en
 * salidas/, que no se sube al repositorio.
 *
 * Necesita el portal en marcha, sin clave de Stripe (para que el pago sea simulado) y con la
 * descarga del PDF activa (config/prototipo.ts; lo está salvo con NEXT_PUBLIC_DESCARGA_PDF=0):
 *   pnpm build && pnpm start -p 3100
 *   pnpm print:sample                          # pack Pequeño
 *   pnpm print:sample mediano                  # otro pack activo del catálogo
 *   pnpm print:sample pequeno http://localhost:3000
 *   pnpm print:sample --sin-caja               # con la caja de siempre (no se imprime)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import catalogo from "../supabase/catalogo.json";

const activos = catalogo.packs.filter((p) => p.activo);
const opciones = process.argv.slice(2).filter((a) => a.startsWith("--"));
const posicionales = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const packId = posicionales[0] ?? "pequeno";
const BASE = posicionales[1] ?? process.env.BASE_URL ?? "http://localhost:3100";
const CON_CAJA = !opciones.includes("--sin-caja");

/** Textos ficticios de la muestra (nombres neutros, nunca de personas reales). */
const MUESTRA = {
  titulo: "Mazo de muestra",
  dedicatoria: "Para Ana y Leo, con todos los recuerdos que aún nos quedan por hacer",
  frase: "La primera tarde de playa del verano",
  recuerdo: "Nuestra primera cita",
  anioRecuerdo: "2012",
};
const SALIDA = path.join(process.cwd(), "salidas");
// Carpeta propia: los tests usan tests/fixtures/generadas.
const FOTOS = path.join(SALIDA, "fotos-sinteticas");

const pack = activos.find((p) => p.id === packId);
if (!pack) {
  console.error(`No hay un pack activo «${packId}». Opciones: ${activos.map((p) => p.id).join(", ")}`);
  process.exit(1);
}

/** Solo los archivos de la carpeta: la subcarpeta escaner/ de `pnpm fixtures` no se sube. */
function archivos(carpeta: string): string[] {
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(carpeta, e.name))
    .sort();
}

/** Dos fotos más que las que incluye el pack, para que el pedido lleve alguna carta extra. */
function prepararFotos(cantidad: number): string[] {
  if (archivos(FOTOS).length !== cantidad) execFileSync("pnpm", ["-s", "fixtures", String(cantidad), FOTOS], { stdio: "inherit" });
  return archivos(FOTOS);
}

async function main() {
  const fotos = prepararFotos(pack!.cartas + 2);
  await mkdir(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ locale: "es-ES", acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const pagina = await contexto.newPage();
  try {
    // Como desde la portada: el configurador abre directamente en Fotos con el pack elegido.
    await pagina.goto(`${BASE}/es/crear?pack=${pack!.id}`);
    await pagina.getByRole("heading", { name: "Sube tus fotos" }).waitFor();
    const otro = pagina.getByRole("button", { name: "Empezar otro mazo" });
    if (await otro.count()) {
      pagina.once("dialog", (d) => void d.accept());
      await otro.first().click();
    }
    await pagina.getByRole("checkbox", { name: /Tengo permiso/ }).check();
    await pagina.getByTestId("entrada-fotos").setInputFiles(fotos);
    await pagina.getByText(`${fotos.length} fotos añadidas`).waitFor({ timeout: 180_000 });
    console.log(`· ${fotos.length} fotos sintéticas cargadas`);

    // Las fotos sin fecha en la cámara ni en el nombre llevan una sugerida: se aceptan todas.
    const sugeridas = pagina.getByRole("button", { name: /^Usar (la fecha sugerida|las \d+ fechas sugeridas)$/ });
    if (await sugeridas.count()) await sugeridas.first().click();

    // Un recuerdo sin foto (carta de texto), con su fecha.
    await pagina.getByRole("button", { name: /Añadir un recuerdo sin foto/ }).first().click();
    const dialogo = pagina.getByRole("dialog");
    await dialogo.getByRole("button", { name: MUESTRA.recuerdo }).click();
    await dialogo.getByRole("radio", { name: "Solo el año" }).click();
    await dialogo.getByLabel("Año").fill(MUESTRA.anioRecuerdo);
    await dialogo.getByRole("button", { name: "Añadir la carta" }).click();
    await dialogo.waitFor({ state: "hidden" });
    console.log(`· recuerdo sin foto «${MUESTRA.recuerdo}» añadido`);

    // Cartas: la frase de la primera carta (una con foto; al entrar se abre el recuerdo recién añadido).
    await pagina.getByRole("button", { name: "Siguiente: cartas" }).click();
    await pagina.getByRole("heading", { name: "Completa las cartas" }).waitFor();
    await pagina.getByRole("list", { name: "Todas las cartas" }).getByRole("button").first().click();
    await pagina.getByLabel(/Frase del recuerdo/).fill(MUESTRA.frase);

    // Estilo: título, dedicatoria (detrás de la portada) y, si se pide, la caja personalizada.
    await pagina.getByRole("button", { name: "Siguiente: estilo" }).click();
    await pagina.getByRole("textbox", { name: "Título del mazo" }).fill(MUESTRA.titulo);
    await pagina.getByLabel(/Dedicatoria/).fill(MUESTRA.dedicatoria);
    if (CON_CAJA) {
      await pagina.getByTestId("bloque-caja").getByRole("switch", { name: /Caja personalizada/ }).click();
      console.log("· caja personalizada con la foto de la portada");
    }

    await pagina.getByRole("button", { name: "Siguiente: pedido" }).click();
    await pagina.getByRole("heading", { name: "Revisa y haz el pedido" }).waitFor();
    const baja = pagina.getByRole("button", { name: "Imprimir igualmente" });
    if (await baja.count()) await baja.first().click();
    await pagina.getByRole("checkbox", { name: /He revisado/ }).check();
    await pagina.getByRole("button", { name: /Pagar .* \(prueba\)/ }).click();
    await pagina.waitForURL((url) => !url.href.startsWith(BASE) || /pedido\/confirmado/.test(url.pathname), { timeout: 60_000 });
    if (!pagina.url().startsWith(BASE)) {
      throw new Error("El servidor tiene una clave de Stripe y ha abierto Stripe Checkout. Arráncalo sin STRIPE_SECRET_KEY para generar la muestra.");
    }

    const boton = pagina.getByRole("button", { name: /Descargar el archivo de impresión/ });
    try {
      await boton.waitFor({ timeout: 30_000 });
    } catch {
      throw new Error("La descarga del PDF está apagada en este servidor. Compílalo sin NEXT_PUBLIC_DESCARGA_PDF=0.");
    }
    const descarga = pagina.waitForEvent("download", { timeout: 300_000 });
    await boton.click();
    const archivo = path.join(SALIDA, `muestra-${packId}.pdf`);
    await (await descarga).saveAs(archivo);
    console.log(`✓ ${path.relative(process.cwd(), archivo)}`);
  } finally {
    await navegador.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
