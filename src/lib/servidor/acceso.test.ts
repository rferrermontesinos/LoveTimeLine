import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COOKIE_ACCESO, decidirAcceso, huellaClave, igualesSeguro, PARAM_ACCESO } from "./acceso";

const CLAVE = "clave-de-prueba-123";
const url = (ruta: string) => new URL(ruta, "https://prueba.ejemplo.test");

describe("acceso privado al prototipo", () => {
  it("sin clave en el entorno no bloquea nada", async () => {
    expect(await decidirAcceso({ clave: undefined, url: url("/es/crear"), cookie: undefined })).toEqual({ tipo: "pasar" });
    expect(await decidirAcceso({ clave: "  ", url: url("/es"), cookie: undefined })).toEqual({ tipo: "pasar" });
  });

  it("sin enlace ni cookie, deniega páginas y API", async () => {
    for (const ruta of ["/", "/es", "/es/crear?pack=pequeno", "/api/checkout", "/api/catalogo"]) {
      expect(await decidirAcceso({ clave: CLAVE, url: url(ruta), cookie: undefined })).toEqual({ tipo: "denegar" });
    }
  });

  it("con el enlace secreto, deja entrar y quita la clave de la dirección", async () => {
    const d = await decidirAcceso({ clave: CLAVE, url: url(`/es/crear?pack=mediano&${PARAM_ACCESO}=${CLAVE}`), cookie: undefined });
    expect(d.tipo).toBe("entrar");
    if (d.tipo !== "entrar") return;
    expect(d.destino.pathname).toBe("/es/crear");
    expect(d.destino.searchParams.get("pack")).toBe("mediano");
    expect(d.destino.searchParams.has(PARAM_ACCESO)).toBe(false);
    expect(d.huella).toBe(await huellaClave(CLAVE));
    expect(d.huella).not.toContain(CLAVE);
  });

  it("con una clave equivocada en el enlace, deniega", async () => {
    expect(await decidirAcceso({ clave: CLAVE, url: url(`/?${PARAM_ACCESO}=otra`), cookie: undefined })).toEqual({ tipo: "denegar" });
  });

  it("con la cookie de la huella, deja pasar; con otra, deniega", async () => {
    const huella = await huellaClave(CLAVE);
    expect(await decidirAcceso({ clave: CLAVE, url: url("/es/crear"), cookie: huella })).toEqual({ tipo: "pasar" });
    expect(await decidirAcceso({ clave: CLAVE, url: url("/es/crear"), cookie: CLAVE })).toEqual({ tipo: "denegar" });
    expect(await decidirAcceso({ clave: "nueva-clave", url: url("/es/crear"), cookie: huella })).toEqual({ tipo: "denegar" });
  });

  it("la página para mandar fotos y el servicio local de la subida colaborativa no se bloquean; lo demás de aportar, sí", async () => {
    const id = "AbCdEfGhIjKlMnOpQrStUv";
    for (const ruta of [`/es/aportar/${id}`, `/en/aportar/${id}`, `/aportar/${id}`, `/es/aportar/${id}/`, "/api/colaboracion/invitaciones", `/api/colaboracion/invitaciones/${id}/aportaciones`]) {
      expect(await decidirAcceso({ clave: CLAVE, url: url(ruta), cookie: undefined }), ruta).toEqual({ tipo: "pasar" });
    }
    for (const ruta of ["/es/aportar", `/es/aportar/${id}/otra`, "/es/aportar/corto", `/es/crear/aportar/${id}`, "/api/colaboracionx", "/es/aportarlo"]) {
      expect(await decidirAcceso({ clave: CLAVE, url: url(ruta), cookie: undefined }), ruta).toEqual({ tipo: "denegar" });
    }
  });

  it("el webhook de Stripe nunca se bloquea", async () => {
    expect(await decidirAcceso({ clave: CLAVE, url: url("/api/stripe/webhook"), cookie: undefined })).toEqual({ tipo: "pasar" });
  });

  it("compara en tiempo constante y distingue longitudes", () => {
    expect(igualesSeguro("abc", "abc")).toBe(true);
    expect(igualesSeguro("abc", "abd")).toBe(false);
    expect(igualesSeguro("abc", "abcd")).toBe(false);
    expect(COOKIE_ACCESO).toMatch(/^[a-z_]+$/);
  });
});

describe("qué rutas pasan por el acceso (el matcher del proxy, compilado como lo hace Next)", async () => {
  // Next añade a cada matcher las variantes internas de las páginas (.rsc, .segments/…): se prueba
  // con su propio compilador para ver lo mismo que en Vercel. El matcher se lee del archivo (Next
  // también lo lee así, sin ejecutarlo).
  type Compilador = { getMiddlewareMatchers: (matcher: string, config: object) => { regexp: string }[] };
  const { getMiddlewareMatchers } = (await import("next/dist/build/analysis/get-page-static-info")) as unknown as Compilador;
  const fuente = readFileSync(path.join(process.cwd(), "src", "proxy.ts"), "utf8");
  const literal = /matcher:\s*("(?:[^"\\]|\\.)*")/.exec(fuente)?.[1];
  if (!literal) throw new Error("No se encuentra el matcher en src/proxy.ts");
  const regexps = getMiddlewareMatchers(JSON.parse(literal) as string, {}).map((m) => new RegExp(m.regexp));
  const pasa = (ruta: string) => regexps.some((r) => r.test(ruta));

  it("las páginas, la API y las variantes internas de las páginas pasan por el acceso", () => {
    for (const ruta of [
      "/",
      "/es",
      "/es/crear",
      "/es/privacidad",
      "/es/aportar/AbCdEfGhIjKlMnOpQrStUv",
      "/api/checkout",
      "/es.rsc",
      "/es/crear.rsc",
      "/es/privacidad.segments/_full.segment.rsc",
      "/es/crear.segments/_tree.segment.rsc",
      "/es/interno/folleto.rsc",
      "/instrucciones/es.pdf",
    ]) {
      expect(pasa(ruta), ruta).toBe(true);
    }
  });

  it("los estáticos sin nada privado no pasan (los necesita la página para mandar fotos)", () => {
    for (const ruta of [
      "/_next/static/chunks/abc.js",
      "/_next/static/immutable/chunks/abc.css",
      "/_next/image",
      "/fonts/cartas/BricolageGrotesque-Bold.woff2",
      "/muestras/playa.jpg",
      "/juego/mesa.jpg",
      "/sw.js",
      "/icono.svg",
      "/robots.txt",
    ]) {
      expect(pasa(ruta), ruta).toBe(false);
    }
  });
});
