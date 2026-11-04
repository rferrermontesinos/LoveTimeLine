/**
 * El configurador sin conexión. Necesita el portal compilado (`pnpm build && pnpm start`): el
 * service worker (public/sw.js) solo se registra en producción.
 */
import { expect, test, type Page } from "@playwright/test";
import catalogo from "../../supabase/catalogo.json";
import { fotos, guardado, soloSugeridas } from "./mazo-utiles";

const pequeno = catalogo.packs.find((p) => p.id === "pequeno")!;

/** El código y las fuentes que ha cargado la página (también lo que se carga bajo demanda). */
function codigoCargado(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((u) => /^\/(_next\/static|fonts)\//.test(new URL(u).pathname)),
  );
}

/** Lo que falta de `urls` en las cachés del sitio (en una caché concreta, si se dice cuál). */
function faltanEnCache(page: Page, urls: string[], cache?: string): Promise<string[]> {
  return page.evaluate(
    async ({ urls, cache }) => {
      const faltan: string[] = [];
      for (const u of urls) {
        const guardada = cache ? await (await caches.open(cache)).match(u, { ignoreVary: true }) : await caches.match(u, { ignoreVary: true });
        if (!guardada) faltan.push(u);
      }
      return faltan;
    },
    { urls, cache },
  );
}

/**
 * Espera a que el service worker controle la página y tenga guardados la página del
 * configurador y todo el código y las fuentes que esta ha cargado.
 */
async function esperarServiceWorker(page: Page) {
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), {
      message: "El service worker no controla la página: ¿es un servidor de desarrollo? Prueba con pnpm build && pnpm start.",
      timeout: 30_000,
    })
    .toBe(true);
  await expect
    .poll(async () => [...(await faltanEnCache(page, ["/es/crear"])), ...(await faltanEnCache(page, await codigoCargado(page)))], {
      message: "El service worker no ha guardado la página, su código y sus fuentes",
      timeout: 30_000,
    })
    .toEqual([]);
}

test("sin conexión, el configurador se vuelve a abrir con el mazo tal cual y no deja pagar", async ({ page, context }) => {
  test.setTimeout(240_000);

  // Un mazo con el mínimo del pack cubierto, ya en Pedido.
  await page.goto("/es/crear?pack=pequeno");
  await page.getByRole("checkbox", { name: /Tengo permiso/ }).check();
  const archivos = fotos();
  expect(archivos.length).toBeGreaterThanOrEqual(pequeno.cartas);
  await page.getByTestId("entrada-fotos").setInputFiles(archivos);
  await expect(page.getByText(`${archivos.length} fotos añadidas`)).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: `Usar las ${archivos.filter(soloSugeridas).length} fechas sugeridas` }).click();
  await page.getByRole("button", { name: "Siguiente: cartas" }).click();
  await page.getByRole("button", { name: "Siguiente: estilo" }).click();
  await page.getByRole("button", { name: "Siguiente: pedido" }).click();
  await expect(page.getByRole("heading", { name: "Revisa y haz el pedido" })).toBeVisible();
  await expect(guardado(page)).toHaveText(/Guardado en este dispositivo/);
  await esperarServiceWorker(page);

  // Se va la conexión: la página vuelve a abrirse desde el service worker, con el mazo.
  await context.setOffline(true);
  // La petición del service worker a la red falla: la página sale de su copia.
  const falloDelServiceWorker = context.waitForEvent("requestfailed", (r) => !!r.serviceWorker() && new URL(r.url()).pathname === "/es/crear");
  const respuesta = await page.reload();
  await falloDelServiceWorker;
  expect(respuesta?.fromServiceWorker()).toBe(true);
  await expect(page.getByTestId("aviso-sin-conexion")).toHaveText("Sin conexión: puedes seguir, todo se guarda en este dispositivo.");
  await expect(page.getByTestId("aviso-reanudar")).toHaveText("Seguimos donde lo dejaste");
  await expect(page.getByRole("heading", { name: "Revisa y haz el pedido" })).toBeVisible();
  await expect(page.getByText(`${archivos.length} cartas · mínimo ${pequeno.cartas}`)).toBeVisible();

  // Se puede seguir (el mazo se sigue guardando aquí), pero no pagar, y se dice por qué.
  await page.getByRole("checkbox", { name: /He revisado/ }).check();
  const pagar = page.getByRole("button", { name: /Pagar .* \(prueba\)/ });
  await expect(pagar).toBeDisabled();
  await expect(page.getByTestId("motivo-sin-conexion")).toHaveText("Para pagar hace falta conexión. Tu mazo sigue guardado aquí.");
  await page.getByRole("navigation", { name: "Pasos" }).getByRole("button", { name: /Cartas/ }).click();
  await expect(page.getByRole("heading", { name: "Completa las cartas" })).toBeVisible();
  await expect(guardado(page)).toHaveText(/Guardado en este dispositivo/);

  // Vuelve la conexión: el aviso se va y ya se puede pagar.
  await context.setOffline(false);
  await expect(page.getByTestId("aviso-sin-conexion")).toBeHidden();
  await page.getByRole("navigation", { name: "Pasos" }).getByRole("button", { name: /Pedido/ }).click();
  await page.getByRole("checkbox", { name: /He revisado/ }).check();
  await expect(pagar).toBeEnabled();
});

test("tras un despliegue, el service worker nuevo también tiene lo que se carga bajo demanda y las fuentes de las cartas", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto("/es/crear?pack=pequeno");
  await expect(page.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
  await esperarServiceWorker(page);
  // Lo cargado incluye lo que la página adelanta para seguir sin conexión: las fuentes de las
  // cartas (desde JS) y el código que se carga bajo demanda, que el HTML no cita.
  const cargado = await codigoCargado(page);
  expect(cargado.filter((u) => u.includes("/fonts/cartas/")).length).toBeGreaterThan(0);

  // Otro despliegue: el navegador instala la versión nueva, que espera mientras esta pestaña use
  // la de antes. Aquí se simula registrando el mismo sw.js con otra versión.
  const NUEVA = "e2e-despliegue";
  await page.evaluate(async (v) => {
    const r = await navigator.serviceWorker.register(`/sw.js?v=${v}`, { scope: "/", updateViaCache: "none" });
    const sw = r.installing ?? r.waiting;
    if (sw && sw.state !== "installed") {
      await new Promise<void>((ok) => sw.addEventListener("statechange", () => sw.state === "installed" && ok()));
    }
  }, NUEVA);
  await expect
    .poll(() => faltanEnCache(page, cargado, `baraja-recuerdos-codigo-${NUEVA}`), { message: "La versión nueva no ha guardado lo que cargó la página", timeout: 30_000 })
    .toEqual([]);

  // Se cierra la pestaña: la nueva se activa, borra las copias de la vieja y se encarga del sitio.
  await page.close();
  const otra = await context.newPage();
  await expect
    .poll(
      async () => {
        await otra.goto("/es/privacidad");
        return otra.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "");
      },
      { timeout: 30_000 },
    )
    .toContain(NUEVA);
  expect((await otra.evaluate(() => caches.keys())).sort()).toEqual([`baraja-recuerdos-codigo-${NUEVA}`, `baraja-recuerdos-paginas-${NUEVA}`]);

  // Sin conexión, el configurador se abre y tiene todo lo que había cargado.
  await context.setOffline(true);
  await otra.goto("/es/crear");
  await expect(otra.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
  expect(await faltanEnCache(otra, cargado)).toEqual([]);
  await context.setOffline(false);
});
