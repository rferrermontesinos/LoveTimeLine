/**
 * Pruebas del service worker (public/sw.js) tal cual se publica: se ejecuta en un contexto aparte
 * con un `self`, unas cachés y una red falsos, y se le mandan los mismos eventos que el navegador.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const ORIGEN = "https://ejemplo.test";
const CODIGO = readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf8");

interface RespuestaFalsa {
  ok: boolean;
  status: number;
  type: string;
  redirected: boolean;
  cuerpo: string;
  clone: () => RespuestaFalsa;
  text: () => Promise<string>;
}

function respuesta(cuerpo: string, opciones: Partial<Pick<RespuestaFalsa, "status" | "type" | "redirected">> = {}): RespuestaFalsa {
  const status = opciones.status ?? 200;
  const r: RespuestaFalsa = {
    ok: status >= 200 && status < 300,
    status,
    type: opciones.type ?? "basic",
    redirected: opciones.redirected ?? false,
    cuerpo,
    clone: () => respuesta(cuerpo, opciones),
    text: async () => cuerpo,
  };
  return r;
}

interface PeticionFalsa {
  url: string;
  method: string;
  mode: string;
  headers: { get: (n: string) => string | null };
}

function peticion(ruta: string, opciones: { mode?: string; method?: string; cabeceras?: Record<string, string> } = {}): PeticionFalsa {
  const cabeceras = new Map(Object.entries(opciones.cabeceras ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    url: new URL(ruta, ORIGEN).href,
    method: opciones.method ?? "GET",
    mode: opciones.mode ?? "cors",
    headers: { get: (n) => cabeceras.get(n.toLowerCase()) ?? null },
  };
}

const clave = (k: string | PeticionFalsa) => new URL(typeof k === "string" ? k : k.url, ORIGEN).href;

/** Cachés en memoria con lo que usa el service worker de la API Cache. */
class CachesFalsas {
  readonly almacen = new Map<string, Map<string, RespuestaFalsa>>();
  async open(nombre: string) {
    if (!this.almacen.has(nombre)) this.almacen.set(nombre, new Map());
    const cache = this.almacen.get(nombre)!;
    return {
      match: async (k: string | PeticionFalsa) => cache.get(clave(k)),
      put: async (k: string | PeticionFalsa, r: RespuestaFalsa) => void cache.set(clave(k), r),
    };
  }
  async keys() {
    return [...this.almacen.keys()];
  }
  async delete(nombre: string) {
    return this.almacen.delete(nombre);
  }
  /** Las rutas guardadas en la caché cuyo nombre empieza así. */
  rutas(prefijo: string): string[] {
    const nombre = [...this.almacen.keys()].find((n) => n.startsWith(prefijo));
    return nombre ? [...this.almacen.get(nombre)!.keys()].map((u) => u.replace(ORIGEN, "")).sort() : [];
  }
}

interface Sw {
  oyentes: Record<string, (evento: unknown) => void>;
  caches: CachesFalsas;
  pedidas: string[];
  reclamado: () => boolean;
  /** Corta la red (después de instalar, por ejemplo). */
  cortarRed: () => void;
  /** Las funciones puras del service worker (declaradas en su ámbito global). */
  global: Record<string, (...a: unknown[]) => unknown>;
}

/**
 * Carga sw.js con una red que contesta con `paginas` (ruta → cuerpo); sin `conRed`, la red falla.
 * Con `caches`, comparte las de otra versión (como en el navegador, tras un despliegue).
 */
function cargarSw({ version = "v2", paginas = {} as Record<string, string>, conRed = true, caches: compartidas = undefined as CachesFalsas | undefined } = {}): Sw {
  const oyentes: Sw["oyentes"] = {};
  const pedidas: string[] = [];
  let reclamado = false;
  let hayRed = conRed;
  const red = async (url: string) => {
    pedidas.push(url.replace(ORIGEN, ""));
    if (!hayRed) throw new TypeError("Failed to fetch");
    const ruta = new URL(url, ORIGEN).pathname;
    return ruta in paginas ? respuesta(paginas[ruta]!) : respuesta("", { status: 404 });
  };
  const caches = compartidas ?? new CachesFalsas();
  const contexto = vm.createContext({
    URL,
    console,
    caches,
    fetch: (r: string | PeticionFalsa) => red(typeof r === "string" ? new URL(r, ORIGEN).href : r.url),
    self: {
      location: new URL(`/sw.js?v=${version}`, ORIGEN),
      addEventListener: (tipo: string, f: (e: unknown) => void) => (oyentes[tipo] = f),
      clients: {
        claim: async () => {
          reclamado = true;
        },
      },
    },
  });
  vm.runInContext(CODIGO, contexto);
  return {
    oyentes,
    caches,
    pedidas,
    reclamado: () => reclamado,
    cortarRed: () => {
      hayRed = false;
    },
    global: contexto as unknown as Sw["global"],
  };
}

/** Lanza un evento con waitUntil y espera a todo lo que haya pedido esperar. */
async function lanzar(sw: Sw, tipo: string, datos: Record<string, unknown> = {}) {
  const esperas: Promise<unknown>[] = [];
  let respondido: Promise<RespuestaFalsa> | null = null;
  sw.oyentes[tipo]!({
    ...datos,
    waitUntil: (p: Promise<unknown>) => esperas.push(p),
    respondWith: (p: Promise<RespuestaFalsa>) => (respondido = p),
  });
  const resultado = respondido ? await (respondido as Promise<RespuestaFalsa>).catch((e: unknown) => e) : null;
  // Lo que se pide esperar puede pedir esperar más (guardar una copia tras responder).
  for (let i = 0; i < esperas.length; i++) await esperas[i];
  return { respondio: respondido !== null, resultado };
}

/** Las fuentes que usan las plantillas de carta (styles/plantillas/*.json), ordenadas. */
const FUENTES_PLANTILLAS = [
  ...new Set(
    readdirSync(path.resolve(__dirname, "../../../styles/plantillas"))
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => {
        const plantilla = JSON.parse(readFileSync(path.resolve(__dirname, "../../../styles/plantillas", f), "utf8")) as { fuentes?: Record<string, { url: string }> };
        return Object.values(plantilla.fuentes ?? {}).map((x) => x.url);
      }),
  ),
].sort();

const HTML_CREAR = [
  '<link rel="stylesheet" href="/_next/static/css/app.css">',
  '<script src="/_next/static/chunks/main.js" async></script>',
  '<script>self.__next_f.push([1,"0:[\\"/_next/static/chunks/main.js\\",\\"/_next/static/chunks/crear.js\\"]"])</script>',
].join("");

describe("service worker: qué pasa por él", () => {
  const sw = cargarSw();
  const estrategia = (p: PeticionFalsa) => sw.global.estrategia!(p, ORIGEN);

  it("las páginas del configurador y de la confirmación, en los dos idiomas, red primero", () => {
    expect(estrategia(peticion("/es/crear", { mode: "navigate" }))).toBe("pagina");
    expect(estrategia(peticion("/en/crear/", { mode: "navigate" }))).toBe("pagina");
    expect(estrategia(peticion("/es/crear?pack=pequeno", { mode: "navigate" }))).toBe("pagina");
    expect(estrategia(peticion("/es/pedido/confirmado?session_id=cs_test", { mode: "navigate" }))).toBe("pagina");
  });

  it("el código y las fuentes, caché primero", () => {
    expect(estrategia(peticion("/_next/static/chunks/main.js"))).toBe("codigo");
    expect(estrategia(peticion("/_next/static/css/app.css"))).toBe("codigo");
    expect(estrategia(peticion("/fonts/ui/bricolage-latin.woff2"))).toBe("codigo");
  });

  it("nada más: otras páginas, la API, la navegación interna (RSC), otros sitios ni otros métodos", () => {
    expect(estrategia(peticion("/es", { mode: "navigate" }))).toBeNull();
    expect(estrategia(peticion("/es/como-jugar", { mode: "navigate" }))).toBeNull();
    expect(estrategia(peticion("/fr/crear", { mode: "navigate" }))).toBeNull();
    expect(estrategia(peticion("/es/crear/otra", { mode: "navigate" }))).toBeNull();
    expect(estrategia(peticion("/api/checkout", { method: "POST" }))).toBeNull();
    expect(estrategia(peticion("/api/checkout/estado?session_id=cs_test"))).toBeNull();
    expect(estrategia(peticion("/es/crear?_rsc=abc"))).toBeNull();
    expect(estrategia(peticion("/es/crear", { cabeceras: { RSC: "1" } }))).toBeNull();
    expect(estrategia(peticion("https://otro.test/_next/static/chunks/main.js"))).toBeNull();
    expect(estrategia(peticion("/_next/static/chunks/main.js", { method: "POST" }))).toBeNull();
  });

  it("encuentra el código y las fuentes que cita una página o una hoja de estilos, sin repetir", () => {
    expect(sw.global.recursosCitados!(HTML_CREAR)).toEqual(["/_next/static/css/app.css", "/_next/static/chunks/main.js", "/_next/static/chunks/crear.js"]);
    expect(sw.global.recursosCitados!('@font-face{src:url(/fonts/ui/latin.woff2) format("woff2")}@font-face{src:url("/fonts/ui/ext.woff2")}')).toEqual([
      "/fonts/ui/latin.woff2",
      "/fonts/ui/ext.woff2",
    ]);
  });

  it("las fuentes de las cartas que guarda al instalarse son las de las plantillas", () => {
    const fuentes = (sw.global as unknown as { FUENTES_CARTAS: string[] }).FUENTES_CARTAS;
    expect([...fuentes].sort()).toEqual(FUENTES_PLANTILLAS);
    for (const f of fuentes) expect(existsSync(path.resolve(__dirname, "../../../public", `.${f}`)), f).toBe(true);
  });

  it("solo las cachés de versiones anteriores son viejas", () => {
    const nombres = ["baraja-recuerdos-paginas-v1", "baraja-recuerdos-codigo-v1", "baraja-recuerdos-paginas-v2", "baraja-recuerdos-codigo-v2", "otra-app"];
    expect(sw.global.cachesViejas!(nombres)).toEqual(["baraja-recuerdos-paginas-v1", "baraja-recuerdos-codigo-v1"]);
  });
});

describe("service worker: sin conexión", () => {
  const paginas = {
    "/es/crear": HTML_CREAR,
    "/en/crear": HTML_CREAR,
    "/es/pedido/confirmado": '<script src="/_next/static/chunks/confirmado.js"></script>',
    "/en/pedido/confirmado": '<script src="/_next/static/chunks/confirmado.js"></script>',
    "/_next/static/css/app.css": "@font-face{src:url(/fonts/ui/latin.woff2)}",
    "/_next/static/chunks/main.js": "main",
    "/_next/static/chunks/crear.js": "crear",
    "/_next/static/chunks/confirmado.js": "confirmado",
    "/_next/static/chunks/editor.js": "editor",
    "/fonts/ui/latin.woff2": "fuente",
    ...Object.fromEntries(FUENTES_PLANTILLAS.map((f) => [f, "fuente de carta"])),
  };

  it("al instalarse guarda las páginas, el código que citan (con las fuentes de sus estilos) y las fuentes de las cartas", async () => {
    const sw = cargarSw({ paginas });
    await lanzar(sw, "install");
    expect(sw.caches.rutas("baraja-recuerdos-paginas-v2")).toEqual(["/en/crear", "/en/pedido/confirmado", "/es/crear", "/es/pedido/confirmado"]);
    expect(sw.caches.rutas("baraja-recuerdos-codigo-v2")).toEqual(
      [
        "/_next/static/chunks/confirmado.js",
        "/_next/static/chunks/crear.js",
        "/_next/static/chunks/main.js",
        "/_next/static/css/app.css",
        "/fonts/ui/latin.woff2",
        ...FUENTES_PLANTILLAS,
      ].sort(),
    );
  });

  it("tras un despliegue, la versión nueva tiene lo que se carga bajo demanda si la página se lo manda también a ella", async () => {
    const caches = new CachesFalsas();
    // La versión de antes, activa: guarda lo que la página cargó bajo demanda (el editor).
    const vieja = cargarSw({ version: "v1", paginas, caches });
    await lanzar(vieja, "install");
    await lanzar(vieja, "activate");
    await lanzar(vieja, "message", { data: { tipo: "guardar", urls: [`${ORIGEN}/_next/static/chunks/editor.js`] } });
    expect(caches.rutas("baraja-recuerdos-codigo-v1")).toContain("/_next/static/chunks/editor.js");

    // La nueva se instala: el HTML no cita el editor, pero las fuentes de las cartas sí las tiene.
    const nueva = cargarSw({ version: "v2", paginas, caches });
    await lanzar(nueva, "install");
    expect(caches.rutas("baraja-recuerdos-codigo-v2")).not.toContain("/_next/static/chunks/editor.js");
    expect(caches.rutas("baraja-recuerdos-codigo-v2")).toEqual(expect.arrayContaining(FUENTES_PLANTILLAS));

    // Mientras espera, la página le manda lo mismo; al activarse borra lo de la vieja y no falta nada.
    await lanzar(nueva, "message", { data: { tipo: "guardar", urls: [`${ORIGEN}/_next/static/chunks/editor.js`] } });
    await lanzar(nueva, "activate");
    expect(await caches.keys()).toEqual(["baraja-recuerdos-paginas-v2", "baraja-recuerdos-codigo-v2"]);
    expect(caches.rutas("baraja-recuerdos-codigo-v2")).toContain("/_next/static/chunks/editor.js");
  });

  it("al activarse borra las copias de versiones anteriores y se encarga de las pestañas abiertas", async () => {
    const sw = cargarSw({ paginas });
    await (await sw.caches.open("baraja-recuerdos-codigo-v1")).put("/_next/static/chunks/viejo.js", respuesta("viejo"));
    await (await sw.caches.open("otra-app")).put("/x", respuesta("x"));
    await lanzar(sw, "install");
    await lanzar(sw, "activate");
    expect(await sw.caches.keys()).toEqual(["otra-app", "baraja-recuerdos-paginas-v2", "baraja-recuerdos-codigo-v2"]);
    expect(sw.reclamado()).toBe(true);
  });

  it("con red, la página llega de la red y se guarda su copia, sin la consulta y solo de visitas sin ella", async () => {
    const sw = cargarSw({ paginas: { ...paginas, "/es/crear": "nueva" } });
    const { resultado } = await lanzar(sw, "fetch", { request: peticion("/es/crear", { mode: "navigate" }) });
    expect((resultado as RespuestaFalsa).cuerpo).toBe("nueva");
    expect((await (await sw.caches.open("baraja-recuerdos-paginas-v2")).match("/es/crear"))?.cuerpo).toBe("nueva");

    const conConsulta = cargarSw({ paginas: { ...paginas, "/es/pedido/confirmado": "con la sesión" } });
    await lanzar(conConsulta, "fetch", { request: peticion("/es/pedido/confirmado?session_id=cs_test", { mode: "navigate" }) });
    expect(conConsulta.caches.rutas("baraja-recuerdos-paginas-v2")).toEqual([]);
  });

  it("sin red, la página sale de la copia, también con consulta; sin copia, falla como sin service worker", async () => {
    const sw = cargarSw({ paginas });
    await lanzar(sw, "install");
    sw.cortarRed();
    const { resultado } = await lanzar(sw, "fetch", { request: peticion("/es/crear?pack=grande", { mode: "navigate" }) });
    expect((resultado as RespuestaFalsa).cuerpo).toBe(HTML_CREAR);

    const vacio = cargarSw({ paginas, conRed: false });
    const { resultado: error } = await lanzar(vacio, "fetch", { request: peticion("/es/crear", { mode: "navigate" }) });
    expect(error).toBeInstanceOf(TypeError);
  });

  it("el código sale de la caché si lo tiene; si no, de la red, y se guarda", async () => {
    const sw = cargarSw({ paginas });
    const primera = await lanzar(sw, "fetch", { request: peticion("/_next/static/chunks/editor.js") });
    expect((primera.resultado as RespuestaFalsa).cuerpo).toBe("editor");
    sw.cortarRed();
    const segunda = await lanzar(sw, "fetch", { request: peticion("/_next/static/chunks/editor.js") });
    expect((segunda.resultado as RespuestaFalsa).cuerpo).toBe("editor");
    expect(sw.pedidas.filter((u) => u.endsWith("editor.js"))).toHaveLength(1);
  });

  it("guarda lo que la página dice haber cargado, solo si es código o fuentes de este sitio", async () => {
    const sw = cargarSw({ paginas });
    await lanzar(sw, "message", {
      data: {
        tipo: "guardar",
        urls: [`${ORIGEN}/_next/static/chunks/editor.js`, `${ORIGEN}/fonts/ui/latin.woff2`, `${ORIGEN}/api/checkout`, `${ORIGEN}/es/crear`, "https://otro.test/_next/static/x.js", 7],
      },
    });
    expect(sw.caches.rutas("baraja-recuerdos-codigo-v2")).toEqual(["/_next/static/chunks/editor.js", "/fonts/ui/latin.woff2"]);
    expect(sw.pedidas).toEqual(["/_next/static/chunks/editor.js", "/fonts/ui/latin.woff2"]);
  });

  it("no hace caso a otros mensajes", async () => {
    const sw = cargarSw({ paginas });
    const { respondio } = await lanzar(sw, "message", { data: { tipo: "borrar", urls: [] } });
    expect(respondio).toBe(false);
    expect(await sw.caches.keys()).toEqual([]);
  });
});
