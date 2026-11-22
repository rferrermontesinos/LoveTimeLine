/**
 * Servicio de la subida colaborativa: guarda, cifradas, las fotos que la familia manda por el
 * enlace de un mazo, hasta que quien hace el mazo las recoge.
 *
 * No sabe leer nada de lo que guarda: cada aportación llega cifrada para la clave pública de quien
 * creó el enlace (ver src/domain/colaboracion/cifrado.ts). Solo comprueba la marca del paquete, su
 * tamaño y los límites. Quien creó el enlace se identifica con un token del que aquí solo se guarda
 * la huella SHA-256.
 *
 * Autocontenido y solo con APIs web (Request, Response, crypto): lo usan la función de Supabase
 * (index.ts, en Deno) y, para desarrollo y pruebas, una ruta de Next con un almacén en disco.
 *
 * Rutas (todo lo anterior al segmento «colaboracion» se ignora):
 *   POST   /invitaciones                          crea un enlace {clavePublica, huellaToken}
 *   GET    /invitaciones/:id                      clave pública y caducidad (para quien aporta)
 *   DELETE /invitaciones/:id                      [token] cierra el enlace y borra lo guardado
 *   POST   /invitaciones/:id/aportaciones         guarda un paquete cifrado (cuerpo binario)
 *   GET    /invitaciones/:id/aportaciones         [token] lista lo que ha llegado
 *   GET    /invitaciones/:id/aportaciones/:aid    [token] descarga un paquete
 *   DELETE /invitaciones/:id/aportaciones/:aid    [token] lo borra (ya está en el mazo)
 *   POST   /purgar                                borra los enlaces caducados (lo llama pg_cron)
 */

export interface Limites {
  /** Días que dura un enlace desde que se crea. */
  diasEnlace: number;
  /** Fotos esperando a la vez en un enlace (se van borrando al añadirlas al mazo). */
  maxFotos: number;
  /** Bytes esperando a la vez en un enlace. */
  maxBytesEnlace: number;
  /** Bytes esperando entre todos los enlaces (el plan gratuito de Supabase da 1 GB). */
  maxBytesTotal: number;
  /** Tamaño máximo de un paquete (copia de trabajo, miniatura y datos, cifrados). */
  maxBytesPaquete: number;
  /** Enlaces sin caducar a la vez, y enlaces nuevos por hora: frenan a quien abuse del servicio. */
  maxEnlacesActivos: number;
  maxEnlacesPorHora: number;
}

export const LIMITES: Limites = {
  diasEnlace: 14,
  maxFotos: 300,
  // Un enlace no puede llenar solo el espacio de todos: como mucho, la mitad (las fotos se borran
  // del servicio en cuanto el dueño las añade al mazo, así que es lo que espera a la vez).
  maxBytesEnlace: 400 * 1024 * 1024,
  maxBytesTotal: 800 * 1024 * 1024,
  maxBytesPaquete: 15 * 1024 * 1024,
  maxEnlacesActivos: 200,
  maxEnlacesPorHora: 30,
};

export interface InvitacionGuardada {
  clavePublica: string;
  huellaToken: string;
  caducaEn: number;
}

export interface AportacionGuardada {
  id: string;
  bytes: number;
  recibidaEn: number;
}

export type ResultadoReserva = "ok" | "no-existe" | "caducada" | "lleno";

/**
 * Dónde se guardan los enlaces y los paquetes. La reserva comprueba los límites y apunta la
 * aportación (aún sin confirmar) en un solo paso, para que dos envíos a la vez no se los salten.
 */
export interface Almacen {
  crear(inv: InvitacionGuardada & { id: string }, l: Limites): Promise<"ok" | "lleno">;
  leer(id: string): Promise<InvitacionGuardada | null>;
  reservar(inv: string, id: string, bytes: number, l: Limites): Promise<ResultadoReserva>;
  confirmar(inv: string, id: string): Promise<void>;
  /** Quita la aportación de la lista (confirmada o no). False si no estaba. */
  quitar(inv: string, id: string): Promise<boolean>;
  /** Solo las confirmadas, de la más antigua a la más nueva. */
  listar(inv: string): Promise<AportacionGuardada[]>;
  borrarInvitacion(inv: string): Promise<void>;
  caducadas(limite: number): Promise<string[]>;
  subirArchivo(ruta: string, datos: Uint8Array): Promise<void>;
  bajarArchivo(ruta: string): Promise<Uint8Array<ArrayBuffer> | null>;
  borrarArchivos(rutas: string[]): Promise<void>;
  listarArchivos(carpeta: string): Promise<string[]>;
}

// ───────────────────────────── Utilidades ─────────────────────────────

const ID = /^[A-Za-z0-9_-]{22}$/;
/** Un punto P-256 sin comprimir (65 bytes) en base64url: 87 caracteres que empiezan por «B». */
const CLAVE_PUBLICA = /^B[A-Za-z0-9_-]{86}$/;
/** SHA-256 en base64url: 43 caracteres. */
const HUELLA = /^[A-Za-z0-9_-]{43}$/;
/** «APR1» y el primer byte de la clave efímera (0x04: punto sin comprimir). */
const MARCA = [0x41, 0x50, 0x52, 0x31, 0x04];
/** Marca y clave efímera (4 + 65), iv (12) y etiqueta de AES-GCM (16). */
const LARGO_MINIMO_PAQUETE = 97;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-token-dueno, x-clave-servicio, authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
};
const CABECERAS: Record<string, string> = { ...CORS, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CABECERAS, "Content-Type": "application/json; charset=utf-8" } });
}

const error = (codigo: string, estado: number) => json({ error: codigo }, estado);

function aBase64url(bytes: Uint8Array): string {
  let binario = "";
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]!);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function idNuevo(): string {
  return aBase64url(crypto.getRandomValues(new Uint8Array(16)));
}

async function huellaDe(texto: string): Promise<string> {
  return aBase64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))));
}

/** Comparación en tiempo constante. */
function iguales(a: string, b: string): boolean {
  let diferencia = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diferencia |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diferencia === 0;
}

export function esPaqueteValido(b: Uint8Array): boolean {
  return b.length >= LARGO_MINIMO_PAQUETE && MARCA.every((x, i) => b[i] === x);
}

class CuerpoDemasiadoGrande extends Error {}

/** Lee el cuerpo sin pasar de `max` bytes (aunque no diga su largo o mienta). */
async function leerCuerpo(req: Request, max: number): Promise<Uint8Array> {
  const declarado = Number(req.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declarado) && declarado > max) throw new CuerpoDemasiadoGrande();
  if (!req.body) return new Uint8Array(0);
  const lector = req.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel().catch(() => undefined);
      throw new CuerpoDemasiadoGrande();
    }
    trozos.push(value);
  }
  const salida = new Uint8Array(total);
  let i = 0;
  for (const t of trozos) {
    salida.set(t, i);
    i += t.byteLength;
  }
  return salida;
}

/** Los segmentos de la ruta después de «colaboracion» (Supabase, Next y Deno la sirven distinta). */
export function segmentos(url: URL): string[] {
  const partes = url.pathname.split("/").filter(Boolean);
  const i = partes.indexOf("colaboracion");
  return i >= 0 ? partes.slice(i + 1) : partes;
}

const ruta = (inv: string, id: string) => `${inv}/${id}`;

// ───────────────────────────── Servicio ─────────────────────────────

export interface OpcionesServicio {
  ahora?: () => number;
  limites?: Partial<Limites>;
  /**
   * El secreto que solo tienen el portal y el servicio: crear un enlace lo pide en la cabecera
   * `x-clave-servicio` (lo pone la ruta /api/enlaces del portal, detrás de su acceso privado). Así
   * nadie de fuera crea enlaces: ni llena el servicio ni se hace páginas «Manda tus fotos» en la web.
   * Vacío: no se puede crear ninguno. Sin la opción (null), no se comprueba: solo pruebas y local.
   */
  claveServicio?: string | null;
}

export function crearServicio(almacen: Almacen, opciones: OpcionesServicio = {}): (req: Request) => Promise<Response> {
  const ahora = opciones.ahora ?? (() => Date.now());
  const l: Limites = { ...LIMITES, ...opciones.limites };
  const claveServicio = opciones.claveServicio ?? null;

  /** Borra los enlaces caducados y todo lo que guardaban. */
  async function purgar(limite = 50): Promise<number> {
    const ids = await almacen.caducadas(limite);
    for (const id of ids) {
      const archivos = await almacen.listarArchivos(id);
      if (archivos.length) await almacen.borrarArchivos(archivos);
      await almacen.borrarInvitacion(id);
    }
    return ids.length;
  }

  /** La invitación si existe y el token es el de quien la creó. */
  async function delDueno(req: Request, id: string): Promise<{ inv: InvitacionGuardada } | { respuesta: Response }> {
    const inv = await almacen.leer(id);
    if (!inv) return { respuesta: error("no-existe", 404) };
    const token = req.headers.get("x-token-dueno") ?? "";
    if (token.length < 32 || token.length > 128 || !iguales(await huellaDe(token), inv.huellaToken)) return { respuesta: error("no-autorizado", 403) };
    return { inv };
  }

  async function crearInvitacion(req: Request): Promise<Response> {
    if (claveServicio !== null) {
      const dada = req.headers.get("x-clave-servicio") ?? "";
      if (!claveServicio || !iguales(dada, claveServicio)) return error("no-autorizado", 403);
    }
    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(new TextDecoder().decode(await leerCuerpo(req, 4096)));
    } catch {
      return error("formato", 400);
    }
    const { clavePublica, huellaToken } = (cuerpo ?? {}) as Record<string, unknown>;
    if (typeof clavePublica !== "string" || !CLAVE_PUBLICA.test(clavePublica) || typeof huellaToken !== "string" || !HUELLA.test(huellaToken)) {
      return error("formato", 400);
    }
    // De paso, se borra lo caducado: así no hace falta esperar a la tarea diaria.
    await purgar(20).catch((e) => console.warn("colaboracion: purga fallida", e instanceof Error ? e.message : e));
    const id = idNuevo();
    const caducaEn = ahora() + l.diasEnlace * 24 * 60 * 60 * 1000;
    const r = await almacen.crear({ id, clavePublica, huellaToken, caducaEn }, l);
    if (r === "lleno") return error("ocupado", 503);
    return json({ id, caducaEn }, 201);
  }

  async function aportar(req: Request, inv: string): Promise<Response> {
    let paquete: Uint8Array;
    try {
      paquete = await leerCuerpo(req, l.maxBytesPaquete);
    } catch (e) {
      if (e instanceof CuerpoDemasiadoGrande) return error("demasiado-grande", 413);
      throw e;
    }
    if (!esPaqueteValido(paquete)) return error("formato", 400);
    const id = idNuevo();
    const r = await almacen.reservar(inv, id, paquete.byteLength, l);
    if (r === "no-existe") return error("no-existe", 404);
    if (r === "caducada") return error("caducada", 410);
    if (r === "lleno") return error("lleno", 409);
    try {
      await almacen.subirArchivo(ruta(inv, id), paquete);
      await almacen.confirmar(inv, id);
    } catch (e) {
      await almacen.quitar(inv, id).catch(() => undefined);
      await almacen.borrarArchivos([ruta(inv, id)]).catch(() => undefined);
      throw e;
    }
    // Si el enlace se ha cerrado (o purgado) mientras llegaba, el paquete no se queda suelto: nadie
    // lo vería ni lo borraría. El cierre, por su parte, vuelve a mirar la carpeta al acabar.
    if (!(await almacen.leer(inv))) {
      await almacen.borrarArchivos([ruta(inv, id)]).catch(() => undefined);
      return error("no-existe", 404);
    }
    return json({ id }, 201);
  }

  async function enrutar(req: Request): Promise<Response> {
    const s = segmentos(new URL(req.url));
    const m = req.method;

    if (s.length === 1 && s[0] === "purgar" && m === "POST") return json({ borradas: await purgar() });
    if (s[0] !== "invitaciones") return error("no-existe", 404);
    if (s.length === 1) return m === "POST" ? crearInvitacion(req) : error("metodo", 405);

    const inv = s[1]!;
    if (!ID.test(inv)) return error("no-existe", 404);

    if (s.length === 2) {
      if (m === "GET") {
        const i = await almacen.leer(inv);
        if (!i) return error("no-existe", 404);
        if (i.caducaEn <= ahora()) return error("caducada", 410);
        return json({ clavePublica: i.clavePublica, caducaEn: i.caducaEn });
      }
      if (m === "DELETE") {
        const d = await delDueno(req, inv);
        if ("respuesta" in d) return d.respuesta;
        const archivos = await almacen.listarArchivos(inv);
        if (archivos.length) await almacen.borrarArchivos(archivos);
        await almacen.borrarInvitacion(inv);
        // Lo que estuviera subiéndose mientras tanto (ver aportar).
        const tardios = await almacen.listarArchivos(inv);
        if (tardios.length) await almacen.borrarArchivos(tardios);
        return new Response(null, { status: 204, headers: CABECERAS });
      }
      return error("metodo", 405);
    }

    if (s[2] !== "aportaciones" || s.length > 4) return error("no-existe", 404);

    if (s.length === 3) {
      if (m === "POST") return aportar(req, inv);
      if (m === "GET") {
        const d = await delDueno(req, inv);
        if ("respuesta" in d) return d.respuesta;
        return json({ caducaEn: d.inv.caducaEn, aportaciones: await almacen.listar(inv) });
      }
      return error("metodo", 405);
    }

    const aid = s[3]!;
    if (!ID.test(aid)) return error("no-existe", 404);
    const d = await delDueno(req, inv);
    if ("respuesta" in d) return d.respuesta;
    if (m === "GET") {
      const datos = await almacen.bajarArchivo(ruta(inv, aid));
      if (!datos) return error("no-existe", 404);
      return new Response(datos, { status: 200, headers: { ...CABECERAS, "Content-Type": "application/octet-stream" } });
    }
    if (m === "DELETE") {
      await almacen.quitar(inv, aid);
      await almacen.borrarArchivos([ruta(inv, aid)]);
      return new Response(null, { status: 204, headers: CABECERAS });
    }
    return error("metodo", 405);
  }

  return async function servir(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CABECERAS });
    try {
      return await enrutar(req);
    } catch (e) {
      // Sin datos personales: solo el mensaje del error.
      console.warn("colaboracion: error", e instanceof Error ? e.message : String(e));
      return error("interno", 500);
    }
  };
}

// ───────────────────────────── Almacén en Supabase ─────────────────────────────

interface ErrorSupabase {
  message: string;
}

/** Lo justo del cliente de supabase-js que usa el almacén (así este archivo no lo importa). */
export interface ClienteSupabase {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: ErrorSupabase | null }>;
  storage: {
    from(bucket: string): {
      upload(ruta: string, cuerpo: Uint8Array, opciones: { contentType: string; upsert: boolean }): PromiseLike<{ error: ErrorSupabase | null }>;
      download(ruta: string): PromiseLike<{ data: Blob | null; error: ErrorSupabase | null }>;
      remove(rutas: string[]): PromiseLike<{ error: ErrorSupabase | null }>;
      list(carpeta: string, opciones: { limit: number; offset: number }): PromiseLike<{ data: { name: string }[] | null; error: ErrorSupabase | null }>;
    };
  };
}

export const BUCKET = "aportaciones";

/** Almacén sobre Postgres (funciones colab_*, ver la migración) y un bucket privado de Storage. */
export function almacenSupabase(sb: ClienteSupabase): Almacen {
  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }
  const bucket = () => sb.storage.from(BUCKET);
  const fecha = (x: unknown) => new Date(String(x)).getTime();

  return {
    async crear(inv, l) {
      return rpc<"ok" | "lleno">("colab_crear", {
        p_id: inv.id,
        p_clave: inv.clavePublica,
        p_huella: inv.huellaToken,
        p_caduca: new Date(inv.caducaEn).toISOString(),
        p_max_activos: l.maxEnlacesActivos,
        p_max_hora: l.maxEnlacesPorHora,
      });
    },
    async leer(id) {
      const filas = await rpc<{ clave_publica: string; huella_token: string; caduca_en: string }[] | null>("colab_leer", { p_id: id });
      const f = filas?.[0];
      return f ? { clavePublica: f.clave_publica, huellaToken: f.huella_token, caducaEn: fecha(f.caduca_en) } : null;
    },
    async reservar(inv, id, bytes, l) {
      return rpc<ResultadoReserva>("colab_reservar", {
        p_inv: inv,
        p_id: id,
        p_bytes: bytes,
        p_max_fotos: l.maxFotos,
        p_max_bytes_enlace: l.maxBytesEnlace,
        p_max_bytes_total: l.maxBytesTotal,
      });
    },
    async confirmar(inv, id) {
      await rpc("colab_confirmar", { p_inv: inv, p_id: id });
    },
    async quitar(inv, id) {
      return Boolean(await rpc<boolean>("colab_quitar", { p_inv: inv, p_id: id }));
    },
    async listar(inv) {
      const filas = await rpc<{ id: string; bytes: number; recibida_en: string }[] | null>("colab_listar", { p_inv: inv });
      return (filas ?? []).map((f) => ({ id: f.id, bytes: Number(f.bytes), recibidaEn: fecha(f.recibida_en) }));
    },
    async borrarInvitacion(inv) {
      await rpc("colab_borrar", { p_inv: inv });
    },
    async caducadas(limite) {
      const filas = await rpc<{ id: string }[] | null>("colab_caducadas", { p_limite: limite });
      return (filas ?? []).map((f) => f.id);
    },
    async subirArchivo(r, datos) {
      const { error } = await bucket().upload(r, datos, { contentType: "application/octet-stream", upsert: false });
      if (error) throw new Error(`subir: ${error.message}`);
    },
    async bajarArchivo(r) {
      const { data, error } = await bucket().download(r);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    async borrarArchivos(rutas) {
      for (let i = 0; i < rutas.length; i += 100) {
        const { error } = await bucket().remove(rutas.slice(i, i + 100));
        if (error) throw new Error(`borrar: ${error.message}`);
      }
    },
    async listarArchivos(carpeta) {
      const nombres: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await bucket().list(carpeta, { limit: 1000, offset });
        if (error) throw new Error(`listar: ${error.message}`);
        nombres.push(...(data ?? []).map((o) => `${carpeta}/${o.name}`));
        if (!data || data.length < 1000) return nombres;
      }
    },
  };
}
