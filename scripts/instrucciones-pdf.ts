/**
 * Genera el folleto de instrucciones en PDF, uno por idioma de la interfaz, a partir de la
 * página /instrucciones en su versión genérica (sin datos de ningún mazo).
 *
 * Cada PDF tiene dos páginas A4 apaisadas (cara A y cara B), con la hoja de 252 × 176 mm
 * centrada y sus marcas de corte y pliegue. Se imprime a doble cara, volteando por el lado
 * corto, al 100 %.
 *
 * Necesita el portal en marcha:
 *   pnpm build && pnpm start -p 3100
 *   pnpm instrucciones:pdf            # o: pnpm instrucciones:pdf http://localhost:3000
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { routing } from "../src/i18n/routing";

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
const DESTINO = path.join(process.cwd(), "public", "instrucciones");

async function main() {
  await mkdir(DESTINO, { recursive: true });
  const navegador = await chromium.launch();
  try {
    for (const idioma of routing.locales) {
      const pagina = await navegador.newPage({ locale: idioma });
      await pagina.goto(`${BASE}/${idioma}/instrucciones?generico=1`, { waitUntil: "load" });
      await pagina.locator('[data-listo="si"]').waitFor({ timeout: 30_000 });
      await pagina.evaluate(() => document.fonts.ready);
      await pagina.emulateMedia({ media: "print" });
      const pdf = await pagina.pdf({ preferCSSPageSize: true, printBackground: true });
      const archivo = path.join(DESTINO, `${idioma}.pdf`);
      await writeFile(archivo, pdf);
      console.log(`✓ ${path.relative(process.cwd(), archivo)} (${Math.round(pdf.length / 1024)} KB)`);
      await pagina.close();
    }
  } finally {
    await navegador.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
