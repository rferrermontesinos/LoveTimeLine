import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { crearServicio, esPaqueteValido, LIMITES, segmentos, type Almacen, type Limites } from "@datos/functions/colaboracion/servicio";
import { aBase64url, clavePublicaCruda, cifrarAportacion, crearLlavesDueno, deBase64url, descifrarAportacion, huellaToken, tokenNuevo } from "@/domain/colaboracion/cifrado";
import { almacenLocal } from "./colaboracionLocal";

const BASE = "https://ejemplo.supabase.co/functions/v1/colaboracion";
const DIA = 24 * 60 * 60 * 1000;

function preparar(opciones: { limites?: Partial<Limites>; carpeta?: string; claveServicio?: string | null; almacen?: (a: Almacen) => Almacen } = {}) {
  let t = Date.UTC(2026, 10, 20, 12);
  const reloj = { ahora: () => t, avanzar: (ms: number) => (t += ms) };
  const base = almacenLocal({ carpeta: opciones.carpeta, ahora: reloj.ahora });
  const almacen = opciones.almacen ? opciones.almacen(base) : base;
  const servir = crearServicio(almacen, { ahora: reloj.ahora, limites: opciones.limites, claveServicio: opciones.claveServicio });
  const pedir = (metodo: string, ruta: string, init: { cuerpo?: BodyInit; token?: string; cabeceras?: Record<string, string> } = {}) =>
    servir(
      new Request(`${BASE}${ruta}`, {
        method: metodo,
        body: init.cuerpo,
        headers: { ...(init.token ? { "x-token-dueno": init.token } : {}), ...init.cabeceras },
        // Necesario en Node para mandar un ReadableStream como cuerpo.
        ...(init.cuerpo instanceof ReadableStream ? { duplex: "half" } : {}),
      } as RequestInit),
    );
  return { reloj, almacen, servir, pedir };
}

/** Crea un enlace como lo hace el navegador de quien hace el mazo. */
async function crearEnlace(pedir: ReturnType<typeof preparar>["pedir"]) {
  const llaves = await crearLlavesDueno();
  const clavePublica = aBase64url(await clavePublicaCruda(llaves));
  const token = tokenNuevo();
  const r = await pedir("POST", "/invitaciones", { cuerpo: JSON.stringify({ clavePublica, huellaToken: await huellaToken(token) }) });
  expect(r.status).toBe(201);
  const { id, caducaEn } = (await r.json()) as { id: string; caducaEn: number };
  return { id, caducaEn, token, llaves, clavePublica };
}

function paquete(clavePublica: string, id: string, contenido = "foto") {
  return cifrarAportacion(new TextEncoder().encode(contenido), deBase64url(clavePublica), id);
}

const temporales: string[] = [];
afterEach(async () => {
  for (const c of temporales.splice(0)) await rm(c, { recursive: true, force: true });
});

describe("servicio de la subida colaborativa", () => {
  it("de principio a fin: crear, aportar, listar, descargar, descifrar y borrar", async () => {
    const { pedir } = preparar();
    const enlace = await crearEnlace(pedir);
    expect(enlace.id).toMatch(/^[A-Za-z0-9_-]{22}$/);

    // Quien aporta lee la clave pública (y en el navegador comprueba su huella con la del enlace).
    const info = await pedir("GET", `/invitaciones/${enlace.id}`);
    expect(info.status).toBe(200);
    expect(await info.json()).toEqual({ clavePublica: enlace.clavePublica, caducaEn: enlace.caducaEn });

    const enviado = await pedir("POST", `/invitaciones/${enlace.id}/aportaciones`, { cuerpo: await paquete(enlace.clavePublica, enlace.id, "la foto del faro") });
    expect(enviado.status).toBe(201);
    const { id: aid } = (await enviado.json()) as { id: string };

    const lista = await pedir("GET", `/invitaciones/${enlace.id}/aportaciones`, { token: enlace.token });
    const cuerpo = (await lista.json()) as { aportaciones: { id: string; bytes: number }[]; caducaEn: number };
    expect(cuerpo.caducaEn).toBe(enlace.caducaEn);
    expect(cuerpo.aportaciones.map((a) => a.id)).toEqual([aid]);

    const bajada = await pedir("GET", `/invitaciones/${enlace.id}/aportaciones/${aid}`, { token: enlace.token });
    expect(bajada.headers.get("content-type")).toBe("application/octet-stream");
    const bytes = new Uint8Array(await bajada.arrayBuffer());
    expect(bytes.length).toBe(cuerpo.aportaciones[0]!.bytes);
    expect(new TextDecoder().decode(await descifrarAportacion(bytes, enlace.llaves, enlace.id))).toBe("la foto del faro");

    expect((await pedir("DELETE", `/invitaciones/${enlace.id}/aportaciones/${aid}`, { token: enlace.token })).status).toBe(204);
    const vacia = (await (await pedir("GET", `/invitaciones/${enlace.id}/aportaciones`, { token: enlace.token })).json()) as { aportaciones: unknown[] };
    expect(vacia.aportaciones).toEqual([]);
    expect((await pedir("GET", `/invitaciones/${enlace.id}/aportaciones/${aid}`, { token: enlace.token })).status).toBe(404);
  });

  it("solo quien creó el enlace lista, descarga, borra o cierra", async () => {
    const { pedir } = preparar();
    const enlace = await crearEnlace(pedir);
    const otro = await crearEnlace(pedir);
    const { id: aid } = (await (await pedir("POST", `/invitaciones/${enlace.id}/aportaciones`, { cuerpo: await paquete(enlace.clavePublica, enlace.id) })).json()) as {
      id: string;
    };
    const rutas: [string, string][] = [
      ["GET", `/invitaciones/${enlace.id}/aportaciones`],
      ["GET", `/invitaciones/${enlace.id}/aportaciones/${aid}`],
      ["DELETE", `/invitaciones/${enlace.id}/aportaciones/${aid}`],
      ["DELETE", `/invitaciones/${enlace.id}`],
    ];
    for (const [metodo, ruta] of rutas) {
      expect((await pedir(metodo, ruta)).status).toBe(403);
      expect((await pedir(metodo, ruta, { token: tokenNuevo() })).status).toBe(403);
      // El token de otro enlace no sirve.
      expect((await pedir(metodo, ruta, { token: otro.token })).status).toBe(403);
    }
    // Sigue todo en su sitio.
    const lista = (await (await pedir("GET", `/invitaciones/${enlace.id}/aportaciones`, { token: enlace.token })).json()) as { aportaciones: unknown[] };
    expect(lista.aportaciones).toHaveLength(1);
  });

  it("rechaza enlaces y paquetes mal formados, rutas desconocidas y paquetes demasiado grandes", async () => {
    const { pedir } = preparar({ limites: { maxBytesPaquete: 2000 } });
    const token = await huellaToken(tokenNuevo());
    for (const cuerpo of ["no es json", "{}", JSON.stringify({ clavePublica: "B".repeat(86), huellaToken: token }), JSON.stringify({ clavePublica: `B${"a".repeat(86)}`, huellaToken: "corta" })]) {
      expect((await pedir("POST", "/invitaciones", { cuerpo })).status).toBe(400);
    }
    expect((await pedir("POST", "/invitaciones", { cuerpo: "x".repeat(5000) })).status).toBe(400);

    const enlace = await crearEnlace(pedir);
    const ruta = `/invitaciones/${enlace.id}/aportaciones`;
    expect((await pedir("POST", ruta, { cuerpo: new Uint8Array(500) })).status).toBe(400);
    expect((await pedir("POST", ruta, { cuerpo: new Uint8Array(3000) })).status).toBe(413);
    // Sin decir su largo (por trozos), también se corta.
    const trozos = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 5; i++) c.enqueue(new Uint8Array(600));
        c.close();
      },
    });
    expect((await pedir("POST", ruta, { cuerpo: trozos })).status).toBe(413);

    expect((await pedir("GET", "/invitaciones/no-es-un-id")).status).toBe(404);
    expect((await pedir("GET", `/invitaciones/${"a".repeat(22)}`)).status).toBe(404);
    expect((await pedir("GET", `/invitaciones/${enlace.id}/otra-cosa`)).status).toBe(404);
    expect((await pedir("GET", "/otra-cosa")).status).toBe(404);
    expect((await pedir("PUT", `/invitaciones/${enlace.id}`)).status).toBe(405);
    expect((await pedir("GET", `/invitaciones/${enlace.id}/aportaciones/../../x`, { token: enlace.token })).status).toBe(404);
  });

  it("pone límites por enlace, entre todos los enlaces y a los enlaces nuevos", async () => {
    const { pedir } = preparar({ limites: { maxFotos: 2, maxEnlacesPorHora: 3 } });
    const enlace = await crearEnlace(pedir);
    const ruta = `/invitaciones/${enlace.id}/aportaciones`;
    for (let i = 0; i < 2; i++) expect((await pedir("POST", ruta, { cuerpo: await paquete(enlace.clavePublica, enlace.id) })).status).toBe(201);
    const lleno = await pedir("POST", ruta, { cuerpo: await paquete(enlace.clavePublica, enlace.id) });
    expect(lleno.status).toBe(409);
    expect(await lleno.json()).toEqual({ error: "lleno" });

    // Al recoger una, cabe otra: el límite es de fotos esperando, no de fotos mandadas.
    const { aportaciones } = (await (await pedir("GET", ruta, { token: enlace.token })).json()) as { aportaciones: { id: string }[] };
    await pedir("DELETE", `${ruta}/${aportaciones[0]!.id}`, { token: enlace.token });
    expect((await pedir("POST", ruta, { cuerpo: await paquete(enlace.clavePublica, enlace.id) })).status).toBe(201);

    await crearEnlace(pedir);
    await crearEnlace(pedir);
    const llaves = await crearLlavesDueno();
    const cuarto = await pedir("POST", "/invitaciones", {
      cuerpo: JSON.stringify({ clavePublica: aBase64url(await clavePublicaCruda(llaves)), huellaToken: await huellaToken(tokenNuevo()) }),
    });
    expect(cuarto.status).toBe(503);
  });

  it("crear enlaces pide el secreto del portal; sin él configurado, no se crea ninguno", async () => {
    const llaves = await crearLlavesDueno();
    const cuerpo = JSON.stringify({ clavePublica: aBase64url(await clavePublicaCruda(llaves)), huellaToken: await huellaToken(tokenNuevo()) });
    const { pedir } = preparar({ claveServicio: "secreto-del-portal-0123456789" });
    expect((await pedir("POST", "/invitaciones", { cuerpo })).status).toBe(403);
    expect((await pedir("POST", "/invitaciones", { cuerpo, cabeceras: { "x-clave-servicio": "otro-secreto-del-portal-0123" } })).status).toBe(403);
    expect((await pedir("POST", "/invitaciones", { cuerpo, cabeceras: { "x-clave-servicio": "secreto-del-portal-0123456789" } })).status).toBe(201);
    const vacia = preparar({ claveServicio: "" });
    expect((await vacia.pedir("POST", "/invitaciones", { cuerpo })).status).toBe(403);
    expect((await vacia.pedir("POST", "/invitaciones", { cuerpo, cabeceras: { "x-clave-servicio": "" } })).status).toBe(403);
  });

  it("un enlace solo puede ocupar parte del espacio de todos", () => {
    expect(LIMITES.maxBytesEnlace * 2).toBeLessThanOrEqual(LIMITES.maxBytesTotal);
  });

  it("si el enlace se cierra mientras llega una foto, no queda ningún paquete suelto", async () => {
    let soltar: () => void = () => undefined;
    const subiendo = new Promise<void>((r) => (soltar = r));
    let empezada: () => void = () => undefined;
    const empieza = new Promise<void>((r) => (empezada = r));
    const { pedir, almacen } = preparar({
      almacen: (a) => ({
        ...a,
        async subirArchivo(ruta, datos) {
          empezada();
          await subiendo;
          return a.subirArchivo(ruta, datos);
        },
      }),
    });
    const enlace = await crearEnlace(pedir);
    const envio = pedir("POST", `/invitaciones/${enlace.id}/aportaciones`, { cuerpo: await paquete(enlace.clavePublica, enlace.id) });
    await empieza;
    expect((await pedir("DELETE", `/invitaciones/${enlace.id}`, { token: enlace.token })).status).toBe(204);
    soltar();
    expect((await envio).status).toBe(404);
    expect(await almacen.listarArchivos(enlace.id)).toEqual([]);
  });

  it("el espacio se comparte entre todos los enlaces", async () => {
    // Todos los paquetes de prueba miden lo mismo: la cabecera, el contenido y la etiqueta.
    const llaves = await crearLlavesDueno();
    const tamano = (await cifrarAportacion(new TextEncoder().encode("foto"), await clavePublicaCruda(llaves), "x")).length;
    const { pedir } = preparar({ limites: { maxBytesTotal: tamano * 2 } });
    const x = await crearEnlace(pedir);
    const y = await crearEnlace(pedir);
    expect((await pedir("POST", `/invitaciones/${x.id}/aportaciones`, { cuerpo: await paquete(x.clavePublica, x.id) })).status).toBe(201);
    expect((await pedir("POST", `/invitaciones/${y.id}/aportaciones`, { cuerpo: await paquete(y.clavePublica, y.id) })).status).toBe(201);
    expect((await pedir("POST", `/invitaciones/${y.id}/aportaciones`, { cuerpo: await paquete(y.clavePublica, y.id) })).status).toBe(409);
  });

  it("los enlaces caducan: no admiten más fotos, quien los creó aún las recoge y la purga lo borra todo", async () => {
    const { pedir, reloj, almacen } = preparar();
    const enlace = await crearEnlace(pedir);
    expect(enlace.caducaEn - reloj.ahora()).toBe(LIMITES.diasEnlace * DIA);
    await pedir("POST", `/invitaciones/${enlace.id}/aportaciones`, { cuerpo: await paquete(enlace.clavePublica, enlace.id) });

    reloj.avanzar(LIMITES.diasEnlace * DIA);
    expect((await pedir("GET", `/invitaciones/${enlace.id}`)).status).toBe(410);
    expect((await pedir("POST", `/invitaciones/${enlace.id}/aportaciones`, { cuerpo: await paquete(enlace.clavePublica, enlace.id) })).status).toBe(410);
    const lista = (await (await pedir("GET", `/invitaciones/${enlace.id}/aportaciones`, { token: enlace.token })).json()) as { aportaciones: unknown[] };
    expect(lista.aportaciones).toHaveLength(1);

    expect(await (await pedir("POST", "/purgar")).json()).toEqual({ borradas: 1 });
    expect((await pedir("GET", `/invitaciones/${enlace.id}`)).status).toBe(404);
    expect(await almacen.listarArchivos(enlace.id)).toEqual([]);
  });

  it("al crear un enlace se borran de paso los caducados", async () => {
    const { pedir, reloj, almacen } = preparar();
    const viejo = await crearEnlace(pedir);
    await pedir("POST", `/invitaciones/${viejo.id}/aportaciones`, { cuerpo: await paquete(viejo.clavePublica, viejo.id) });
    reloj.avanzar(LIMITES.diasEnlace * DIA + 1);
    await crearEnlace(pedir);
    expect(await almacen.leer(viejo.id)).toBeNull();
    expect(await almacen.listarArchivos(viejo.id)).toEqual([]);
  });

  it("cerrar el enlace borra lo que esperaba", async () => {
    const { pedir, almacen } = preparar();
    const enlace = await crearEnlace(pedir);
    await pedir("POST", `/invitaciones/${enlace.id}/aportaciones`, { cuerpo: await paquete(enlace.clavePublica, enlace.id) });
    expect((await pedir("DELETE", `/invitaciones/${enlace.id}`, { token: enlace.token })).status).toBe(204);
    expect((await pedir("GET", `/invitaciones/${enlace.id}`)).status).toBe(404);
    expect((await pedir("POST", `/invitaciones/${enlace.id}/aportaciones`, { cuerpo: await paquete(enlace.clavePublica, enlace.id) })).status).toBe(404);
    expect(await almacen.listarArchivos(enlace.id)).toEqual([]);
  });

  it("responde a CORS y nunca deja copias en caché", async () => {
    const { pedir } = preparar();
    const previa = await pedir("OPTIONS", "/invitaciones");
    expect(previa.status).toBe(204);
    expect(previa.headers.get("access-control-allow-origin")).toBe("*");
    expect(previa.headers.get("access-control-allow-headers")).toContain("x-token-dueno");
    const r = await pedir("GET", `/invitaciones/${"a".repeat(22)}`);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("entiende la ruta como la sirven Supabase, Deno y Next", () => {
    for (const base of ["https://x.supabase.co/functions/v1/colaboracion", "http://localhost:8000/colaboracion", "http://localhost:3000/api/colaboracion"]) {
      expect(segmentos(new URL(`${base}/invitaciones/abc/aportaciones`))).toEqual(["invitaciones", "abc", "aportaciones"]);
    }
  });

  it("la marca del paquete que comprueba el servicio es la del cifrado del navegador", async () => {
    const llaves = await crearLlavesDueno();
    const p = await cifrarAportacion(new Uint8Array(10), await clavePublicaCruda(llaves), "x");
    expect(esPaqueteValido(p)).toBe(true);
    expect(esPaqueteValido(p.subarray(0, 96))).toBe(false);
    expect(esPaqueteValido(new Uint8Array(200))).toBe(false);
  });

  it("el almacén en disco guarda lo mismo y lo recuerda al reiniciar", async () => {
    const carpeta = await mkdtemp(path.join(tmpdir(), "colaboracion-"));
    temporales.push(carpeta);
    const { pedir } = preparar({ carpeta });
    const enlace = await crearEnlace(pedir);
    await pedir("POST", `/invitaciones/${enlace.id}/aportaciones`, { cuerpo: await paquete(enlace.clavePublica, enlace.id, "en disco") });
    expect(await readdir(path.join(carpeta, "archivos", enlace.id))).toHaveLength(1);

    // Otro proceso (otro almacén sobre la misma carpeta) lo ve todo.
    const { pedir: pedirDespues } = preparar({ carpeta });
    const { aportaciones } = (await (await pedirDespues("GET", `/invitaciones/${enlace.id}/aportaciones`, { token: enlace.token })).json()) as {
      aportaciones: { id: string }[];
    };
    const bytes = new Uint8Array(await (await pedirDespues("GET", `/invitaciones/${enlace.id}/aportaciones/${aportaciones[0]!.id}`, { token: enlace.token })).arrayBuffer());
    expect(new TextDecoder().decode(await descifrarAportacion(bytes, enlace.llaves, enlace.id))).toBe("en disco");
    await pedirDespues("DELETE", `/invitaciones/${enlace.id}`, { token: enlace.token });
    expect(await readdir(path.join(carpeta, "archivos", enlace.id))).toEqual([]);
  });
});
