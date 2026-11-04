/**
 * Genera un PDF de impresión de muestra con datos ficticios, recorriendo el portal como lo
 * haría un cliente: fotos sintéticas (las de `pnpm fixtures`), estilo, pago simulado y
 * descarga del archivo de impresión. El PDF queda en salidas/, que no se sube al repositorio.
 *
 * Necesita el portal en marcha y sin clave de Stripe, para que el pago sea simulado:
 *   pnpm build && pnpm start -p 3100
 *   pnpm print:sample                 # pack Pareja
 *   pnpm print:sample familia         # pack Familia
 *   pnpm print:sample pareja http://localhost:3000
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import catalogo from "../supabase/catalogo.json";

const packId = process.argv[2] ?? "pareja";
const BASE = process.argv[3] ?? process.env.BASE_URL ?? "http://localhost:3100";
const SALIDA = path.join(process.cwd(), "salidas");
// Carpeta propia: los tests usan tests/fixtures/generadas con 42 fotos.
const FOTOS = path.join(SALIDA, "fotos-sinteticas");

const pack = catalogo.packs.find((p) => p.id === packId);
if (!pack) {
  console.error(`No existe el pack «${packId}». Opciones: ${catalogo.packs.map((p) => p.id).join(", ")}`);
  process.exit(1);
}

/** Dos fotos más que el mínimo del pack, para que aparezca una ampliación. */
function prepararFotos(cantidad: number): string[] {
  const actuales = existsSync(FOTOS) ? readdirSync(FOTOS) : [];
  if (actuales.length !== cantidad) execFileSync("pnpm", ["-s", "fixtures", String(cantidad), FOTOS], { stdio: "inherit" });
  return readdirSync(FOTOS)
    .sort()
    .map((f) => path.join(FOTOS, f));
}

async function main() {
  const fotos = prepararFotos(pack!.cartas + 2);
  await mkdir(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ locale: "es-ES", acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const pagina = await contexto.newPage();
  try {
    await pagina.goto(`${BASE}/es/crear`);
    await pagina.getByRole("button", { name: new RegExp(`Empezar con ${pack!.nombre.es}`) }).click();
    await pagina.getByRole("checkbox", { name: /Tengo permiso/ }).check();
    await pagina.getByTestId("entrada-fotos").setInputFiles(fotos);
    await pagina.getByText(new RegExp(`${fotos.length} fotos añadidas`)).waitFor({ timeout: 180_000 });
    console.log(`· ${fotos.length} fotos sintéticas cargadas`);

    await pagina.getByRole("button", { name: /Siguiente: cartas/ }).click();
    await pagina.getByLabel(/Frase del recuerdo/).fill("Recuerdo de muestra");
    await pagina.getByRole("button", { name: /Siguiente: estilo/ }).click();
    await pagina.getByLabel("Título del mazo").fill("Mazo de muestra");
    await pagina.getByLabel(/Dedicatoria/).fill("Texto de prueba para comprobar la dedicatoria impresa.");

    await pagina.getByRole("button", { name: /Siguiente: pedido/ }).click();
    const baja = pagina.getByRole("button", { name: "Imprimir igualmente" });
    if (await baja.count()) await baja.first().click();
    await pagina.getByRole("checkbox", { name: /He revisado/ }).check();
    await pagina.getByRole("button", { name: /Pagar .* \(prueba\)/ }).click();
    await pagina.waitForURL((url) => !url.href.startsWith(BASE) || /pedido\/confirmado/.test(url.pathname), { timeout: 60_000 });
    if (!pagina.url().startsWith(BASE)) {
      throw new Error("El servidor tiene una clave de Stripe y ha abierto Stripe Checkout. Arráncalo sin STRIPE_SECRET_KEY para generar la muestra.");
    }

    const descarga = pagina.waitForEvent("download", { timeout: 300_000 });
    await pagina.getByRole("button", { name: /Descargar el archivo de impresión/ }).click();
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
