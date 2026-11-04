/**
 * Páginas públicas: la portada (packs a primera vista, «Continuar mi mazo», tipos de juego),
 * «Cómo se juega» (la escena de la mesa y las reglas), los créditos de las fotos de muestra y las
 * rutas internas cerradas. Packs, claims y precios salen del catálogo (supabase/catalogo.json) con
 * las mismas funciones que la web: aquí no hay importes escritos a mano.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { paisesConEnvio } from "../../src/components/inicio/envio";
import { CARTAS_POR_PERSONA } from "../../src/domain/juego/reglas";
import { formatearImporte, packPorDefecto, packsActivos } from "../../src/domain/precios/cotizar";
import { textoEn, type Catalogo } from "../../src/domain/precios/tipos";

function leerJson<T>(...partes: string[]): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), ...partes), "utf8")) as T;
}

const catalogo = leerJson<Catalogo>("supabase", "catalogo.json");
const packs = packsActivos(catalogo);
const mesaAlt = leerJson<{ juego: { mesaAlt: string } }>("messages", "es", "juego.json").juego.mesaAlt;
/** «Pack {pack}»: cómo nombra la barra del configurador el pack elegido. */
const packEnBarra = leerJson<{ crear: { pack: string } }>("messages", "es", "crear.json").crear.pack;
const escaparRegExp = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const creditos = leerJson<{ fuente: string; licencia: { nombre: string; url: string }; fotos: { fotografo: string; pagina: string }[] }>("public", "muestras", "creditos.json");

const IDIOMAS = ["es", "en"] as const;
type Idioma = (typeof IDIOMAS)[number];
const PAGINAS = ["", "/como-jugar", "/privacidad"];

/** Primer pantallazo que pide el encargo: portátil y móvil. */
const pantallaDe = (proyecto: string) => (proyecto === "movil" ? { width: 390, height: 844 } : { width: 1280, height: 800 });

/**
 * Tipos de juego y extras retirados, el enfoque viejo de la portada («Para que no gane siempre
 * quien hizo el mazo») y la franja de meses: no pueden salir en ninguna página pública. «Guardián»
 * con mayúscula es el tipo de juego retirado; el «guardián de la memoria» en minúscula es un papel
 * de las reglas de Nuestra historia («Cómo se juega») y se queda.
 */
const RETIRADOS: Record<Idioma, RegExp[]> = {
  es: [/Guardián/, /\bDuelo\b/i, /\bGeneraciones\b/i, /Cu[eé]ntalo/i, /\bRetos\b/i, /\blino\b/i, /no gane siempre/i, /franja/i],
  en: [/Memory Keeper/, /\bGuardian\b/i, /\bDuel\b/i, /\bGenerations\b/i, /\bTell it\b/, /\bChallenge pack\b/i, /\blinen\b/i, /always win/i, /month strip/i],
};
/** En la portada solo están los dos tipos de juego: ni siquiera el papel de guardián. */
const RETIRADOS_PORTADA: Record<Idioma, RegExp[]> = { es: [/guardi[aá]n/i], en: [/keeper/i] };

/** Guarda en IndexedDB, como lo hace el configurador, un mazo de «Ana y Leo» con tres recuerdos de texto. */
async function sembrarMazo(page: Page, { pagado }: { pagado: boolean }) {
  await page.evaluate(async (pagado) => {
    const ahora = Date.now();
    const db = await new Promise<IDBDatabase>((ok, mal) => {
      const r = indexedDB.open("baraja-recuerdos");
      r.onupgradeneeded = () => r.result.createObjectStore("datos");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    const carta = (id: string, descripcion: string, fecha: object) => ({ id, tipo: "texto", fecha, fuente: "manual", confianza: "alta", revisar: false, descripcion, destacada: false, anadidaEn: ahora });
    const mazo = {
      version: 2,
      id: pagado ? "mazo-prueba-pagado" : "mazo-prueba",
      creadoEn: ahora - 3 * 3_600_000,
      // Guardado hace 2 horas y 5 minutos: el aviso dice «hace 2 horas».
      actualizadoEn: ahora - 2 * 3_600_000 - 5 * 60_000,
      packId: "pequeno",
      estiloId: "naipe",
      paletaId: "rosa",
      titulo: "Ana y Leo",
      dedicatoria: "",
      portadaId: null,
      caja: null,
      tono: "original",
      idiomaMazo: "es",
      mecanicas: [],
      extras: [],
      consentimientoFotos: null,
      paso: 1,
      cartas: [
        carta("t1", "El día que nos conocimos", { anio: 2015, mes: 9 }),
        carta("t2", "Nuestra primera cita", { anio: 2015, mes: 11, dia: 7 }),
        carta("t3", "El interrail de aquel verano", { anio: 2016 }),
      ],
      pedido: pagado ? { id: "PRUEBA-1", modo: "simulado", estado: "pagado", totalCents: 4900, moneda: "EUR", cartasFisicas: 41, fecha: ahora } : null,
    };
    await new Promise<void>((ok, mal) => {
      const tx = db.transaction("datos", "readwrite");
      tx.objectStore("datos").put(mazo, "mazo-actual");
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
    db.close();
  }, pagado);
}

/** Da tiempo a que la portada se hidrate y lea el almacén del dispositivo. */
async function esperarAlmacen(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/**
 * Apunta los errores de la página mientras dure la prueba: excepciones, `console.error` (React
 * avisa así, por ejemplo, de una hidratación que no cuadra) y respuestas de error (400 o más) de
 * la propia web, como una imagen que no está. La prueba exige al final que la lista siga vacía.
 */
function vigilarErrores(page: Page, baseURL: string | undefined): string[] {
  const origen = new URL(baseURL ?? "http://localhost").origin;
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(`excepción en ${page.url()}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(`console.error en ${page.url()}: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === origen) errores.push(`${r.status()} ${r.url()}`);
  });
  return errores;
}

/** ¿El punto central del elemento lo recibe él (o algo suyo), sin nada encima que lo tape? */
const centroLibre = (el: Element) => {
  const r = el.getBoundingClientRect();
  const arriba = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!arriba && el.contains(arriba);
};

test.describe("portada", () => {
  test("los tres packs se ven a primera vista, con su claim, sus cartas y sus precios del catálogo", async ({ page }, info) => {
    expect(packs).toHaveLength(3);
    const pantalla = pantallaDe(info.project.name);
    await page.setViewportSize(pantalla);
    for (const idioma of IDIOMAS) {
      await page.goto(`/${idioma}`);
      const selector = page.locator("#precios");
      await expect(selector).toBeVisible();
      await expect(selector.locator("[data-pack]")).toHaveCount(packs.length);
      for (const p of packs) {
        const fila = selector.locator(`[data-pack="${p.id}"]`);
        const nombre = textoEn(p.nombre, idioma);
        await expect(fila.getByRole("heading", { name: nombre })).toBeVisible();
        await expect(fila.getByText(textoEn(p.claim, idioma), { exact: true })).toBeVisible();
        await expect(fila.getByText(String(p.cartas), { exact: true })).toBeVisible();
        await expect(fila.getByText(formatearImporte(p.precioCents, p.moneda, idioma), { exact: true })).toBeVisible();
        // El precio de cada carta de más está una vez a la vista (en el móvil, bajo el claim).
        await expect(fila.getByText(formatearImporte(p.precioCartaExtraCents, p.moneda, idioma)).filter({ visible: true })).toHaveCount(1);
        const boton = fila.getByRole("link", { name: idioma === "es" ? `Empezar con el pack ${nombre}` : `Start with the ${nombre} pack` });
        await expect(boton).toHaveAttribute("href", `/${idioma}/crear?pack=${p.id}`);
        if (idioma === "es") {
          // A primera vista: la fila entera, con su botón, cabe en la primera pantalla.
          const caja = await fila.boundingBox();
          expect(caja!.y + caja!.height, `${p.id} a ${pantalla.width} × ${pantalla.height}`).toBeLessThanOrEqual(pantalla.height);
          await expect(boton).toBeInViewport({ ratio: 1 });
        }
      }
      // Notas: recuerdos sin foto al mismo precio, caja incluida y personalizable con su precio, envío.
      const caja = catalogo.extras.find((e) => e.activo && e.efecto === "caja-personalizada");
      if (caja?.precio.tipo !== "fijo") throw new Error("El catálogo no tiene la caja personalizada con precio fijo");
      await expect(selector).toContainText(idioma === "es" ? "recuerdos sin foto" : "memories with no photo");
      await expect(selector).toContainText(formatearImporte(caja.precio.cents, catalogo.moneda, idioma));
      await expect(selector).toContainText(paisesConEnvio(catalogo, idioma)!);
    }
  });

  test("el botón de un pack abre el configurador con ese pack elegido", async ({ page }) => {
    // Un pack que no sea el de por defecto: si se perdiera ?pack= o el configurador no lo leyera,
    // saldría otro y la prueba fallaría.
    const p = packs.find((x) => x.id !== packPorDefecto(catalogo)?.id)!;
    const nombre = textoEn(p.nombre, "es");
    await page.goto("/es");
    await page.getByRole("link", { name: `Empezar con el pack ${nombre}` }).click();
    await expect(page).toHaveURL(/\/es\/crear(\?|$)/);
    // La barra del configurador nombra el pack elegido y, en su selector, es el marcado.
    const barra = page.getByRole("button", { name: new RegExp(`^${escaparRegExp(packEnBarra.replace("{pack}", nombre))}\\b`) });
    await expect(barra).toBeVisible();
    await barra.click();
    await expect(page.getByRole("radio", { name: nombre, exact: true })).toBeChecked();
    for (const otro of packs.filter((x) => x.id !== p.id)) await expect(page.getByRole("radio", { name: textoEn(otro.nombre, "es"), exact: true })).not.toBeChecked();
  });

  test("«Tipos de juego» enseña exactamente dos tipos y lleva a sus reglas", async ({ page }) => {
    await page.goto("/es");
    const tipos = page.getByRole("region", { name: "Tipos de juego" });
    await expect(tipos.getByRole("heading", { name: "Tipos de juego", level: 2 })).toBeVisible();
    await expect(tipos.locator("[data-modo]")).toHaveCount(2);
    await expect(tipos.getByRole("heading", { level: 3 })).toHaveText(["Clásico", "Nuestra historia"]);
    await expect(tipos).toContainText(`${CARTAS_POR_PERSONA} cartas`);
    await expect(tipos.getByRole("link", { name: "Reglas del Clásico" })).toHaveAttribute("href", "/es/como-jugar#clasico");
    await tipos.getByRole("link", { name: "Reglas de Nuestra historia" }).click();
    await expect(page).toHaveURL(/\/es\/como-jugar#historia$/);
    await expect(page.getByRole("tab", { name: "Nuestra historia" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Nuestra historia" })).toBeInViewport();
  });
});

test.describe("«Continuar mi mazo»", () => {
  test("solo sale con un mazo guardado, sin mover la página, dice si ya está pedido y se puede cerrar", async ({ page }) => {
    // Suma de los saltos de maquetación de cada carga (Cumulative Layout Shift).
    await page.addInitScript(() => {
      const w = window as unknown as { __saltos: number };
      w.__saltos = 0;
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__saltos += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    const aviso = page.locator("[data-aviso-borrador]");

    await page.goto("/es");
    await esperarAlmacen(page);
    await expect(aviso).toHaveCount(0);

    await sembrarMazo(page, { pagado: false });
    await page.reload();
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveCSS("position", "fixed");
    await expect(page.getByRole("complementary", { name: "Tu mazo guardado" })).toBeVisible();
    await expect(aviso.getByRole("heading", { name: "Ana y Leo" })).toBeVisible();
    await expect(aviso).toContainText("Tienes un mazo a medias");
    // En el móvil esta línea solo la leen los lectores de pantalla; desde sm se ve.
    await expect(aviso).toContainText("3 cartas · guardado hace 2 horas");
    await expect(aviso.getByRole("link", { name: "Continuar mi mazo" })).toHaveAttribute("href", "/es/crear");
    await page.waitForTimeout(1000);
    const saltos = await page.evaluate(() => (window as unknown as { __saltos: number }).__saltos);
    expect(saltos).toBeLessThan(0.01);

    // Cerrado, no vuelve en esta sesión mientras el mazo no cambie.
    await aviso.getByRole("button", { name: "Cerrar el aviso" }).click();
    await expect(aviso).toHaveCount(0);
    await page.reload();
    await esperarAlmacen(page);
    await expect(aviso).toHaveCount(0);

    // Con un pedido pagado (otro mazo), vuelve a salir y lo dice.
    await sembrarMazo(page, { pagado: true });
    await page.reload();
    await expect(aviso).toContainText("Mazo ya pedido");
    await expect(aviso.getByRole("link", { name: "Ver mi mazo" })).toHaveAttribute("href", "/es/crear");
  });

  test("a 390 × 844 es una barra baja que deja los tres packs a la vista y sin tapar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/es");
    await sembrarMazo(page, { pagado: false });
    for (const idioma of IDIOMAS) {
      await page.goto(`/${idioma}`);
      const aviso = page.locator("[data-aviso-borrador]");
      await expect(aviso).toBeVisible();
      const barra = (await aviso.boundingBox())!;
      expect(barra.height, `alto del aviso en /${idioma}`).toBeLessThanOrEqual(64);
      // Sus botones siguen siendo objetivos táctiles de 44 px.
      for (const control of [aviso.getByRole("link", { name: idioma === "es" ? "Continuar mi mazo" : "Continue my deck" }), aviso.getByRole("button")]) {
        await expect(control).toBeVisible();
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      for (const p of packs) {
        const fila = page.locator(`#precios [data-pack="${p.id}"]`);
        // La fila entera (nombre, claim, cartas, precios y botón) queda por encima del aviso…
        const caja = (await fila.boundingBox())!;
        expect(caja.y + caja.height, `${p.id} en /${idioma}: fila bajo el aviso`).toBeLessThanOrEqual(barra.y);
        // …y su botón se ve entero y nada lo tapa.
        const nombre = textoEn(p.nombre, idioma);
        const boton = fila.getByRole("link", { name: idioma === "es" ? `Empezar con el pack ${nombre}` : `Start with the ${nombre} pack` });
        await expect(boton).toBeInViewport({ ratio: 1 });
        expect(await boton.evaluate(centroLibre), `botón de ${p.id} en /${idioma}`).toBe(true);
      }
    }
  });
});

test.describe("«Cómo se juega»", () => {
  test("la mesa es una sola imagen descrita, cabe en la pantalla y tiene su leyenda", async ({ page }, info) => {
    await page.setViewportSize(pantallaDe(info.project.name));
    await page.goto("/es/como-jugar");
    const escena = page.getByRole("img", { name: mesaAlt });
    await expect(escena).toBeVisible();
    // Las cartas están ocultas a los lectores de pantalla: dentro de la escena no hay más imágenes.
    await expect(escena.getByRole("img")).toHaveCount(0);
    const piezas = page.locator("[data-escena] [data-pieza]");
    expect(await piezas.count()).toBeGreaterThanOrEqual(10);
    for (const pieza of await piezas.all()) await expect(pieza).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("figure:has([data-escena]) figcaption li")).toHaveCount(6);
    const caja = (await escena.boundingBox())!;
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(pantallaDe(info.project.name).width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("las reglas van en dos pestañas que se usan con el teclado, con 7 cartas por persona", async ({ page }) => {
    await page.goto("/es/como-jugar");
    const pestanas = page.getByRole("tablist", { name: "Tipos de juego" }).getByRole("tab");
    await expect(pestanas).toHaveCount(2);
    // El número de la pestaña es decorativo: el nombre accesible es solo el del tipo de juego.
    await expect(pestanas.nth(0)).toHaveAccessibleName("Clásico");
    await expect(pestanas.nth(1)).toHaveAccessibleName("Nuestra historia");
    await expect(pestanas.first()).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Clásico" })).toContainText(`${CARTAS_POR_PERSONA} cartas por persona`);
    await pestanas.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(pestanas.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(pestanas.nth(1)).toBeFocused();
    await expect(page).toHaveURL(/\/es\/como-jugar#historia$/);
    const historia = page.getByRole("tabpanel", { name: "Nuestra historia" });
    await expect(historia).toContainText(`${CARTAS_POR_PERSONA} cartas por persona`);
    await expect(page.getByRole("tabpanel", { name: "Clásico" })).toBeHidden();
    await page.keyboard.press("Home");
    await expect(pestanas.first()).toHaveAttribute("aria-selected", "true");
  });

  test("un ancla mal escapada no tira la página: se abre la primera pestaña", async ({ page, baseURL }) => {
    const errores = vigilarErrores(page, baseURL);
    const pestanas = page.getByRole("tablist", { name: "Tipos de juego" }).getByRole("tab");
    const sigueEntera = async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Cómo se juega" })).toBeVisible();
      await expect(pestanas).toHaveCount(2);
      await expect(pestanas.first()).toHaveAttribute("aria-selected", "true");
    };
    // Al cargar con un «%» suelto, como queda un enlace cortado al pegarlo en una app de mensajería.
    await page.goto("/es/como-jugar#%");
    await sigueEntera();
    // Y si después el ancla cambia a un escape cortado (hashchange).
    await page.evaluate(() => {
      window.location.hash = "%E0%A4%A";
    });
    await expect(page).toHaveURL(/#%E0%A4%A$/);
    await sigueEntera();
    // Las pestañas siguen vivas: un ancla buena vuelve a abrir la suya.
    await page.evaluate(() => {
      window.location.hash = "historia";
    });
    await expect(page.getByRole("tab", { name: "Nuestra historia" })).toHaveAttribute("aria-selected", "true");
    expect(errores).toEqual([]);
  });

  test("la carta que flota se queda quieta con el movimiento reducido", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/es/como-jugar");
    const flota = page.locator('[data-pieza="candidata"] > div');
    await expect(flota).toHaveCSS("animation-name", "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(flota).not.toHaveCSS("animation-name", "none");
  });
});

test.describe("páginas públicas", () => {
  test("cada una tiene su h1, carga sin errores y no se sale a lo ancho", async ({ page, baseURL }) => {
    const errores = vigilarErrores(page, baseURL);
    for (const idioma of IDIOMAS) {
      for (const ruta of PAGINAS) {
        await page.goto(`/${idioma}${ruta}`);
        await expect(page.locator("h1"), `/${idioma}${ruta}`).toHaveCount(1);
        await expect(page.locator("h1")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `/${idioma}${ruta}`).toBe(true);
      }
    }
    expect(errores).toEqual([]);
  });

  test("no queda nada de los tipos de juego ni de los extras retirados, ni enlaces al folleto", async ({ page }) => {
    for (const idioma of IDIOMAS) {
      const retiradosDelCatalogo = [...catalogo.extras, ...catalogo.mecanicas].filter((x) => !x.activo).map((x) => textoEn(x.nombre, idioma));
      for (const ruta of PAGINAS) {
        await page.goto(`/${idioma}${ruta}`);
        // Todo el texto de la página: el título de la pestaña, la descripción para buscadores y
        // redes, el cuerpo entero (también la cinta del prototipo y las pestañas ocultas, sin los
        // datos de los scripts) y los textos alternativos y etiquetas que no se ven.
        const texto = await page.evaluate(() => {
          const cuerpo = document.body.cloneNode(true) as HTMLElement;
          for (const n of cuerpo.querySelectorAll("script, style, noscript, template")) n.remove();
          const metas = [...document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')].map((m) => m.getAttribute("content") ?? "");
          const atributos = [...cuerpo.querySelectorAll("[alt], [aria-label], [title]")].flatMap((n) => ["alt", "aria-label", "title"].map((a) => n.getAttribute(a) ?? ""));
          return [document.title, ...metas, cuerpo.textContent ?? "", ...atributos].join("\n");
        });
        // Lo que se revisa incluye de verdad un título y una descripción.
        expect(await page.title(), `/${idioma}${ruta}`).not.toBe("");
        await expect(page.locator('meta[name="description"]'), `/${idioma}${ruta}`).toHaveAttribute("content", /\S/);
        const patrones = [...RETIRADOS[idioma], ...(ruta === "" ? RETIRADOS_PORTADA[idioma] : []), /timeline/i];
        for (const patron of patrones) expect(texto, `/${idioma}${ruta}`).not.toMatch(patron);
        for (const nombre of retiradosDelCatalogo) expect(texto, `/${idioma}${ruta}`).not.toContain(nombre);
        await expect(page.locator('a[href*="instrucciones"], a[href*="folleto"], a[href*="/interno"]')).toHaveCount(0);
      }
    }
  });

  test("los créditos de las fotos se ven en el pie y llevan a la lista de autores", async ({ page }) => {
    await page.goto("/es");
    const linea = page.locator("[data-creditos-fotos]");
    await linea.scrollIntoViewIfNeeded();
    await expect(linea).toBeVisible();
    await expect(linea).toContainText(`Fotos de muestra: ${creditos.fuente}`);
    await linea.getByRole("link", { name: "ver autores" }).click();
    await expect(page).toHaveURL(/\/es\/privacidad#fotos$/);
    const seccion = page.getByRole("region", { name: "Fotos de muestra" });
    await expect(seccion).toBeInViewport();
    await expect(seccion.getByRole("listitem")).toHaveCount(creditos.fotos.length);
    for (const f of creditos.fotos) {
      await expect(seccion.locator(`a[href="${f.pagina}"]`)).toHaveCount(1);
      await expect(seccion).toContainText(f.fotografo);
    }
    await expect(seccion.getByRole("link", { name: creditos.licencia.nombre })).toHaveAttribute("href", creditos.licencia.url);
  });
});

test.describe("rutas internas", () => {
  test.skip(process.env.HERRAMIENTAS_INTERNAS === "1", "Con la variable interna activada, estas rutas existen a propósito.");

  for (const ruta of ["/es/instrucciones", "/es/interno/folleto", "/es/interno/cartas", "/instrucciones/es.pdf"]) {
    test(`${ruta} no existe en la web pública`, async ({ request }) => {
      expect((await request.get(ruta)).status()).toBe(404);
    });
  }
});
