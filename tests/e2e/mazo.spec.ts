import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

// Fotos sintéticas generadas con `pnpm fixtures`; nunca fotos reales.
const CARPETA = path.join(process.cwd(), "tests", "fixtures", "generadas");
const fotos = () =>
  readdirSync(CARPETA)
    .sort()
    .map((f) => path.join(CARPETA, f));

test.describe("subida de fotos", () => {
  test("lee las fechas de los nombres y del EXIF y pide revisar las dudosas", async ({ page }) => {
    await page.goto("/es/crear");
    await page.getByRole("button", { name: /Empezar con Pareja/ }).click();
    await page.getByRole("checkbox", { name: /Tengo permiso/ }).check();
    const muestra = fotos().filter((f) => /^(IMG_|DSC|foto-|verano)/.test(path.basename(f))).slice(0, 8);
    await page.getByTestId("entrada-fotos").setInputFiles(muestra);
    await expect(page.getByText(/8 fotos añadidas/)).toBeVisible({ timeout: 60_000 });
    // Las fotos sin fecha en el nombre ni en EXIF quedan «por revisar».
    await expect(page.getByText(/por revisar/)).toBeVisible();
    // Subir la misma foto otra vez no la duplica.
    await page.getByTestId("entrada-fotos").setInputFiles(muestra.slice(0, 1));
    await expect(page.getByText(/1 foto repetida no se ha añadido/)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("mazo de principio a fin", () => {
  test("sube 42 fotos, edita, elige estilo, paga en modo prueba y descarga el PDF", async ({ page }, info) => {
    test.skip(info.project.name === "movil", "El flujo completo se prueba en escritorio; en el móvil, la subida.");
    test.setTimeout(240_000);
    await page.goto("/es/crear");
    await page.getByRole("button", { name: /Empezar con Pareja/ }).click();
    await page.getByRole("checkbox", { name: /Tengo permiso/ }).check();
    await page.getByTestId("entrada-fotos").setInputFiles(fotos());
    await expect(page.getByText(/42 fotos añadidas/)).toBeVisible({ timeout: 120_000 });

    // Paso 2: una frase en la primera carta.
    await page.getByRole("button", { name: /Siguiente: cartas/ }).click();
    await expect(page.getByRole("heading", { name: "Completa las cartas" })).toBeVisible();
    await page.getByLabel(/Frase del recuerdo/).fill("Primer viaje juntos");

    // Paso 3: estilo Familia y título.
    await page.getByRole("button", { name: /Siguiente: estilo/ }).click();
    await page.getByRole("radiogroup", { name: "Estilo" }).getByText("Familia", { exact: true }).click();
    await page.getByLabel("Título del mazo").fill("Prueba de impresión");

    // Paso 4: revisión y pago simulado.
    await page.getByRole("button", { name: /Siguiente: pedido/ }).click();
    await expect(page.getByRole("heading", { name: "Revisa y haz el pedido" })).toBeVisible();
    const baja = page.getByRole("button", { name: "Imprimir igualmente" });
    if (await baja.count()) await baja.first().click();
    await page.getByRole("checkbox", { name: /He revisado/ }).check();
    await page.getByRole("button", { name: /Pagar .* \(prueba\)/ }).click();

    await expect(page).toHaveURL(/\/es\/pedido\/confirmado/);
    await expect(page.getByRole("heading", { name: "Pedido de prueba hecho" })).toBeVisible();

    const descarga = page.waitForEvent("download", { timeout: 180_000 });
    await page.getByRole("button", { name: /Descargar el archivo de impresión/ }).click();
    const archivo = await (await descarga).path();
    const pdf = await PDFDocument.load(await readFile(archivo));
    // Portada + 42 fotos + 2 comodines + 4 en blanco + caja = 50 piezas, a dos caras.
    expect(pdf.getPageCount()).toBe(100);
    const primera = pdf.getPage(0);
    expect(Math.round(primera.getTrimBox().width / (72 / 25.4))).toBe(63);
    expect(Math.round(primera.getBleedBox().height / (72 / 25.4))).toBe(94);
  });
});

test.describe("páginas", () => {
  test("portada, cómo se juega e instrucciones se cargan sin errores", async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    for (const ruta of ["/es", "/en", "/es/como-jugar", "/es/privacidad", "/es/instrucciones"]) {
      await page.goto(ruta);
      await expect(page.locator("h1").first()).toBeVisible();
    }
    // Las dos caras del folleto plegable.
    await expect(page.locator(".hoja-folleto")).toHaveCount(2);
    expect(errores).toEqual([]);
  });

  test("una ruta que no existe muestra la página traducida", async ({ page }) => {
    await page.goto("/en/no-existe");
    await expect(page.getByRole("heading", { name: "This page doesn’t exist." })).toBeVisible();
  });
});
