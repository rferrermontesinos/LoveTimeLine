/**
 * Lo que puede pasar mientras entran fotos y al deshacer (revisión de pantallas del 22-11-2026):
 * pagar a medias, empezar otro mazo a medias, las mismas fotos dos veces, girar y deshacer, borrar
 * todas y dónde queda el foco.
 */
import { expect, test, type Page } from "@playwright/test";
import { conFecha, fotos, leerMazo } from "./mazo-utiles";

/** Empieza un mazo con el pack pequeño y da el permiso de las fotos. */
async function empezar(page: Page) {
  await page.goto("/es/crear?pack=pequeno");
  await expect(page.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
  await page.getByRole("checkbox", { name: /Tengo permiso/ }).check();
}

async function irA(page: Page, paso: "Fotos" | "Cartas" | "Estilo" | "Pedido") {
  await page.getByRole("navigation", { name: "Pasos" }).getByRole("button", { name: new RegExp(paso) }).click();
}

/**
 * Cada foto tarda un poco más en leerse, como en un móvil con fotos grandes: así la importación
 * dura lo bastante para hacer otras cosas mientras tanto.
 */
async function lecturaLenta(page: Page, ms = 250) {
  await page.addInitScript((espera) => {
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      await new Promise((ok) => setTimeout(ok, espera));
      return original(...args);
    }) as typeof createImageBitmap;
  }, ms);
}

/** Ancho y alto de la foto guardada en el navegador para una carta. */
async function medidasGuardadas(page: Page, id: string): Promise<{ ancho: number; alto: number }> {
  return page.evaluate(async (clave) => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const r = indexedDB.open("baraja-recuerdos");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    try {
      const blob = await new Promise<Blob>((ok, ko) => {
        const r = db.transaction("datos").objectStore("datos").get(clave);
        r.onsuccess = () => ok(r.result as Blob);
        r.onerror = () => ko(r.error);
      });
      const b = await createImageBitmap(blob);
      return { ancho: b.width, alto: b.height };
    } finally {
      db.close();
    }
  }, `foto:${id}:copia`);
}

interface CartaGuardada {
  id: string;
  ancho: number;
  alto: number;
  descripcion: string;
}

test.describe("mientras entran fotos", () => {
  test("no se puede pagar hasta que acaban, y el mazo que queda las tiene todas", async ({ page }) => {
    await lecturaLenta(page);
    await empezar(page);
    const archivos = fotos();
    await page.getByTestId("entrada-fotos").setInputFiles(archivos);
    await expect(page.getByText(new RegExp(`Leyendo \\d+ de ${archivos.length} fotos`)).first()).toBeVisible();
    await irA(page, "Pedido");
    const motivo = page.getByTestId("motivo-importando");
    await expect(motivo).toHaveText("Aún están entrando fotos en el mazo. Podrás pagar en cuanto acaben.");
    await expect(page.getByRole("button", { name: /^Pagar/ })).toBeDisabled();
    await expect(motivo).toBeHidden({ timeout: 120_000 });
    await expect.poll(async () => (await leerMazo(page))?.cartas.length).toBe(archivos.length);
  });

  test("«Empezar otro mazo» a medias: el nuevo empieza vacío, sin las fotos del anterior y sin el permiso", async ({ page }) => {
    await lecturaLenta(page, 400);
    await empezar(page);
    const archivos = fotos().slice(0, 20);
    await page.getByTestId("entrada-fotos").setInputFiles(archivos);
    // Con las primeras cartas ya guardadas y el resto aún por leer.
    await expect.poll(async () => (await leerMazo(page))?.cartas.length ?? 0).toBeGreaterThan(0);
    await expect(page.getByText(/Leyendo \d+ de 20 fotos/).first()).toBeVisible();
    const anterior = await leerMazo(page);
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Empezar otro mazo" }).first().click();
    await expect(page.getByRole("checkbox", { name: /Tengo permiso/ })).not.toBeChecked();
    await expect.poll(async () => (await leerMazo(page))?.id).not.toBe(anterior?.id);
    // Lo que quedaba por leer no llega al mazo nuevo, ni ahora ni un rato después.
    await page.waitForTimeout(3_000);
    const nuevo = await leerMazo(page);
    expect(nuevo?.id).not.toBe(anterior?.id);
    expect(nuevo?.cartas).toEqual([]);
    expect(nuevo?.consentimientoFotos).toBeNull();
    await expect(page.getByText(/Leyendo/)).toHaveCount(0);
  });

  test("las mismas fotos otra vez mientras entran: ninguna repetida", async ({ page }) => {
    await empezar(page);
    const archivos = fotos().filter(conFecha).slice(0, 8);
    await page.getByTestId("entrada-fotos").setInputFiles(archivos);
    await page.getByTestId("entrada-fotos").setInputFiles(archivos);
    await expect(page.getByText(`${archivos.length} fotos repetidas no se han añadido`)).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => (await leerMazo(page))?.cartas.length).toBe(archivos.length);
  });
});

test.describe("deshacer y foco", () => {
  test("girar no se deshace: deshacer lo de antes deja la foto girada con sus medidas", async ({ page }, info) => {
    test.skip(info.project.name === "movil", "La lógica es la misma; basta con probarla en escritorio.");
    await empezar(page);
    await page.getByTestId("entrada-fotos").setInputFiles(fotos().filter(conFecha).slice(0, 1));
    await expect(page.getByText("1 foto añadida")).toBeVisible({ timeout: 60_000 });
    await irA(page, "Cartas");
    const [antes] = ((await leerMazo(page))?.cartas ?? []) as CartaGuardada[];
    await page.getByRole("textbox", { name: /frase/i }).first().fill("En la playa");
    await page.getByRole("button", { name: /Girar/ }).click();
    await expect.poll(async () => (((await leerMazo(page))?.cartas ?? []) as CartaGuardada[])[0]?.ancho).toBe(antes!.alto);
    await page.getByRole("button", { name: /Deshacer/ }).click();
    await expect.poll(async () => (((await leerMazo(page))?.cartas ?? []) as CartaGuardada[])[0]?.descripcion).toBe("");
    const [despues] = ((await leerMazo(page))?.cartas ?? []) as CartaGuardada[];
    // La carta sigue con las medidas de la foto girada, que es la que hay guardada.
    expect([despues!.ancho, despues!.alto]).toEqual([antes!.alto, antes!.ancho]);
    expect(await medidasGuardadas(page, despues!.id)).toEqual({ ancho: despues!.ancho, alto: despues!.alto });
  });

  test("borrar todas: el aviso con «Deshacer» sigue a la vista, con el foco, y deshacer las devuelve", async ({ page }) => {
    await empezar(page);
    const archivos = fotos().filter(conFecha).slice(0, 3);
    await page.getByTestId("entrada-fotos").setInputFiles(archivos);
    await expect(page.getByText("3 fotos añadidas")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
    const cartas = page.getByRole("region", { name: /^Tus cartas/ }).getByRole("listitem").getByRole("button");
    await expect(cartas).toHaveCount(3);
    for (const carta of await cartas.all()) await carta.click();
    await expect(page.getByText("3 seleccionadas")).toBeVisible();
    await page.getByRole("button", { name: "Borrar", exact: true }).click();
    await expect(page.getByText("3 cartas borradas.")).toBeVisible();
    const deshacer = page.getByRole("button", { name: /Deshacer/ });
    await expect(deshacer).toBeFocused();
    await deshacer.click();
    await expect(page.getByRole("button", { name: "Seleccionar", exact: true })).toBeFocused();
    await expect.poll(async () => (await leerMazo(page))?.cartas.length).toBe(3);
  });

  test("al cerrar el encuadre, el foco vuelve a su botón", async ({ page }, info) => {
    test.skip(info.project.name === "movil", "El foco del teclado se prueba en escritorio.");
    await empezar(page);
    await page.getByTestId("entrada-fotos").setInputFiles(fotos().filter(conFecha).slice(0, 1));
    await expect(page.getByText("1 foto añadida")).toBeVisible({ timeout: 60_000 });
    await irA(page, "Cartas");
    const encuadrar = page.getByRole("button", { name: /Encuadrar/ });
    await encuadrar.click();
    await expect(page.getByRole("dialog", { name: "Encuadrar la foto" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(encuadrar).toBeFocused();
  });
});
