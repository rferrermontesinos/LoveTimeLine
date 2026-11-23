/**
 * Genera el folleto plegable en PDF para la imprenta, uno por idioma de la interfaz, a partir
 * de la herramienta interna /<idioma>/interno/folleto en su versión genérica (sin datos de
 * ningún mazo). El folleto no está en la web pública: va dentro de la caja, con el packaging.
 *
 * Cada PDF tiene dos páginas A4 apaisadas (cara A y cara B), con la hoja de 252 × 176 mm
 * centrada y sus marcas de corte y pliegue. Se imprime a doble cara, volteando por el lado
 * corto, al 100 %. Se guarda en salidas/folleto/ (fuera del repositorio).
 *
 * Necesita el portal en marcha con las herramientas internas activadas:
 *   HERRAMIENTAS_INTERNAS=1 pnpm dev -p 3100
 *   pnpm instrucciones:pdf            # o: pnpm instrucciones:pdf http://localhost:3000
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { routing } from "../src/i18n/routing";

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
const DESTINO = path.join(process.cwd(), "salidas", "folleto");

async function main() {
  await mkdir(DESTINO, { recursive: true });
  const navegador = await chromium.launch();
  try {
    for (const idioma of routing.locales) {
      const pagina = await navegador.newPage({ locale: idioma });
      const url = `${BASE}/${idioma}/interno/folleto?generico=1`;
      const respuesta = await pagina.goto(url, { waitUntil: "load" });
      if (respuesta?.status() === 404) throw new Error(`${url} da 404: arranca el portal con HERRAMIENTAS_INTERNAS=1.`);
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
