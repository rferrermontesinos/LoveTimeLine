import { describe, expect, it } from "vitest";
import { crearServicio } from "@datos/functions/colaboracion/servicio";
import { aBase64url, clavePublicaCruda, crearLlavesDueno, huellaToken, tokenNuevo } from "@/domain/colaboracion/cifrado";
import { almacenLocal } from "./colaboracionLocal";
import { crearEnlaceEnServicio } from "./enlaces";

const SECRETO = "secreto-del-portal-0123456789";

async function cuerpoDeEnlace() {
  const llaves = await crearLlavesDueno();
  return JSON.stringify({ clavePublica: aBase64url(await clavePublicaCruda(llaves)), huellaToken: await huellaToken(tokenNuevo()) });
}

/** El servicio de verdad, con el secreto, detrás de un `fetch` que apunta lo que recibe. */
function servicio() {
  const servir = crearServicio(almacenLocal(), { claveServicio: SECRETO });
  const pedidas: Request[] = [];
  const buscar = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(entrada, init);
    pedidas.push(req.clone());
    return servir(req);
  }) as typeof fetch;
  return { buscar, pedidas };
}

const peticion = (cuerpo: string, url = "https://portal.ejemplo/api/enlaces") => new Request(url, { method: "POST", body: cuerpo });

describe("crear un enlace desde el portal (/api/enlaces)", () => {
  it("pasa la petición al servicio con el secreto, y el servicio crea el enlace", async () => {
    const { buscar, pedidas } = servicio();
    const r = await crearEnlaceEnServicio(peticion(await cuerpoDeEnlace()), { base: "https://ejemplo.supabase.co/functions/v1/colaboracion", secreto: SECRETO, buscar });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ id: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/) });
    expect(pedidas[0]!.url).toBe("https://ejemplo.supabase.co/functions/v1/colaboracion/invitaciones");
    expect(pedidas[0]!.headers.get("x-clave-servicio")).toBe(SECRETO);
  });

  it("sin el secreto en el portal, el servicio no crea nada", async () => {
    const { buscar } = servicio();
    const r = await crearEnlaceEnServicio(peticion(await cuerpoDeEnlace()), { base: "https://ejemplo.supabase.co/functions/v1/colaboracion", secreto: undefined, buscar });
    expect(r.status).toBe(403);
  });

  it("en local, el servicio es una ruta de la propia web", async () => {
    const { buscar, pedidas } = servicio();
    await crearEnlaceEnServicio(peticion(await cuerpoDeEnlace(), "http://localhost:3100/api/enlaces"), { base: "/api/colaboracion", secreto: SECRETO, buscar });
    expect(pedidas[0]!.url).toBe("http://localhost:3100/api/colaboracion/invitaciones");
  });

  it("sin servicio configurado, con un cuerpo enorme o sin red, no llega a crear nada", async () => {
    const { buscar, pedidas } = servicio();
    expect((await crearEnlaceEnServicio(peticion("{}"), { base: null, secreto: SECRETO, buscar })).status).toBe(404);
    expect((await crearEnlaceEnServicio(peticion("x".repeat(5000)), { base: "/api/colaboracion", secreto: SECRETO, buscar })).status).toBe(400);
    expect(pedidas).toHaveLength(0);
    const sinRed = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect((await crearEnlaceEnServicio(peticion("{}"), { base: "/api/colaboracion", secreto: SECRETO, buscar: sinRed })).status).toBe(502);
  });
});
