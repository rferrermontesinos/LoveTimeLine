/**
 * Genera los archivos de impresión de muestra con datos ficticios, uno por imprenta, recorriendo el
 * portal como lo haría un cliente: empieza en Fotos con el pack elegido, sube fotos sintéticas (las
 * de `pnpm fixtures`), pone el año a las que se quedan sin fecha, añade un recuerdo sin foto,
 * escribe la frase de una carta, pone título y dedicatoria, pide la caja personalizada (con la foto
 * de la portada), paga en modo simulado y descarga el archivo de cada imprenta (config/print.ts).
 * Así la muestra lleva todo lo que se imprime: texto detrás de la portada, frases, cartas de texto
 * y la caja. Los archivos quedan en salidas/, que no se sube al repositorio.
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
import { chromium, type Page } from "@playwright/test";
import { IMPRENTAS } from "../config/print";
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
  recuerdo: "El día que nos conocimos",
  anioRecuerdo: "2012",
  /** Para las fotos sintéticas que no traen ninguna pista de fecha. */
  anioSinFecha: "2016",
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

/**
 * En Fotos, pone el mismo año a todas las que no tienen fecha, como lo haría el cliente:
 * «Seleccionar», tocarlas, «Poner fecha» y el año. Devuelve cuántas eran.
 */
async function ponerAnioALasSinFecha(pagina: Page, anio: string): Promise<number> {
  const grupo = pagina.getByTestId("fotos-sin-fecha");
  if (!(await grupo.count())) return 0;
  const sinFecha = await grupo.getByRole("button").all();
  await pagina.getByRole("button", { name: "Seleccionar", exact: true }).click();
  for (const carta of sinFecha) await carta.click();
  await pagina.getByRole("button", { name: "Poner fecha", exact: true }).click();
  const dialogo = pagina.getByRole("dialog", { name: "Poner la misma fecha" });
  await dialogo.getByRole("radio", { name: "Solo el año" }).click();
  await dialogo.getByLabel("Año").fill(anio);
  await dialogo.getByRole("button", { name: /^Poner esta fecha a / }).click();
  await dialogo.waitFor({ state: "hidden" });
  return sinFecha.length;
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

    // Las que no traen ninguna pista de fecha: el mismo año a todas, como lo haría el cliente.
    const sinFecha = await ponerAnioALasSinFecha(pagina, MUESTRA.anioSinFecha);
    if (sinFecha) console.log(`· año ${MUESTRA.anioSinFecha} a las ${sinFecha} fotos sin fecha`);

    // Cartas: un recuerdo sin foto (carta de texto), con su fecha.
    await pagina.getByRole("button", { name: "Siguiente: cartas" }).click();
    await pagina.getByRole("heading", { name: "Completa las cartas" }).waitFor();
    await pagina.getByTestId("ideas-recuerdo").getByRole("button", { name: MUESTRA.recuerdo }).click();
    const dialogo = pagina.getByRole("dialog");
    await dialogo.getByRole("radio", { name: "Solo el año" }).click();
    await dialogo.getByLabel("Año").fill(MUESTRA.anioRecuerdo);
    await dialogo.getByRole("button", { name: "Añadir la carta" }).click();
    await dialogo.waitFor({ state: "hidden" });
    console.log(`· recuerdo sin foto «${MUESTRA.recuerdo}» añadido`);

    // La frase de una carta con foto.
    await pagina.getByTestId("linea-del-mazo").getByRole("button", { name: /\.jpe?g, .*, lista$/i }).first().click();
    await pagina.getByLabel(/Frase del recuerdo/).fill(MUESTRA.frase);

    // Estilo: título, dedicatoria (detrás de la portada) y, si se pide, la caja personalizada.
    await pagina.getByTestId("mazo-listo").getByRole("button", { name: /Siguiente: estilo/ }).click();
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

    // Un archivo por imprenta, con el sangrado, las marcas y el reparto de páginas que pide cada una.
    const bloque = pagina.getByTestId("bloque-descarga");
    try {
      await bloque.waitFor({ timeout: 30_000 });
    } catch {
      throw new Error("La descarga del PDF está apagada en este servidor. Compílalo sin NEXT_PUBLIC_DESCARGA_PDF=0.");
    }
    for (const perfil of IMPRENTAS) {
      const tipo = perfil.paginas === "separadas" ? "ZIP" : "PDF";
      const boton = bloque.getByTestId(`imprenta-${perfil.id}`).getByRole("button", { name: new RegExp(`^Descargar ${tipo} para`) });
      const descarga = pagina.waitForEvent("download", { timeout: 300_000 });
      await boton.click();
      const d = await descarga;
      const archivo = path.join(SALIDA, `muestra-${d.suggestedFilename()}`);
      await d.saveAs(archivo);
      console.log(`✓ ${path.relative(process.cwd(), archivo)}`);
    }
  } finally {
    await navegador.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
