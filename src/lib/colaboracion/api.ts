/**
 * Cliente del servicio de la subida colaborativa (supabase/functions/colaboracion/servicio.ts).
 * Solo mueve paquetes cifrados y la lista de lo que ha llegado: no ve nada de las fotos.
 */
import { esIdEnlace } from "./enlace";

export interface AportacionEnEspera {
  id: string;
  bytes: number;
  /** Cuándo llegó al servicio (su reloj, no el de quien la manda). */
  recibidaEn: number;
}

/**
 * Un error del servicio: `estado` es el código HTTP (0 si no hubo respuesta) y `codigo`, el que
 * devuelve el servicio («no-existe», «caducada», «lleno», «ocupado», «demasiado-grande»…) o «red».
 */
export class ErrorServicio extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
  ) {
    super(`Servicio de colaboración: ${estado} ${codigo}`);
    this.name = "ErrorServicio";
  }
}

export interface ClienteColaboracion {
  crear(clavePublica: string, huellaToken: string): Promise<{ id: string; caducaEn: number }>;
  /** Para quien aporta: la clave pública del dueño y hasta cuándo vale el enlace. */
  info(id: string): Promise<{ clavePublica: string; caducaEn: number }>;
  aportar(id: string, paquete: Uint8Array<ArrayBuffer>): Promise<{ id: string }>;
  listar(id: string, token: string): Promise<{ caducaEn: number; aportaciones: AportacionEnEspera[] }>;
  descargar(id: string, aportacion: string, token: string): Promise<Uint8Array<ArrayBuffer>>;
  quitar(id: string, aportacion: string, token: string): Promise<void>;
  /** Cierra el enlace: nadie más puede mandar fotos y se borra lo que esperaba. */
  cerrar(id: string, token: string): Promise<void>;
}

const esNumero = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const esTexto = (x: unknown): x is string => typeof x === "string" && x.length > 0;

/**
 * `base`: la dirección del servicio sin barra final (URL_COLABORACION). `crearEn`: dónde se crean los
 * enlaces, si no es en el propio servicio: en la web, la ruta /api/enlaces del portal, que firma la
 * petición con su secreto (ver src/app/api/enlaces). Esa sí lleva las cookies (el acceso privado).
 */
export function clienteColaboracion(base: string, buscar: typeof fetch = (...a) => fetch(...a), opciones: { crearEn?: string } = {}): ClienteColaboracion {
  async function pedir(ruta: string, init: RequestInit & { token?: string; url?: string } = {}): Promise<Response> {
    const { token, url, ...resto } = init;
    const cabeceras = new Headers(resto.headers);
    if (token) cabeceras.set("x-token-dueno", token);
    let r: Response;
    try {
      r = await buscar(url ?? `${base}${ruta}`, { ...resto, headers: cabeceras, cache: "no-store", credentials: url ? "same-origin" : "omit" });
    } catch {
      throw new ErrorServicio(0, "red");
    }
    if (r.ok) return r;
    let codigo = "desconocido";
    try {
      const cuerpo = (await r.json()) as { error?: unknown };
      if (esTexto(cuerpo.error)) codigo = cuerpo.error;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new ErrorServicio(r.status, codigo);
  }

  async function json<T>(r: Response, valido: (x: Record<string, unknown>) => boolean): Promise<T> {
    let cuerpo: unknown;
    try {
      cuerpo = await r.json();
    } catch {
      throw new ErrorServicio(r.status, "respuesta");
    }
    if (typeof cuerpo !== "object" || cuerpo === null || !valido(cuerpo as Record<string, unknown>)) throw new ErrorServicio(r.status, "respuesta");
    return cuerpo as T;
  }

  const enlace = (id: string) => `/invitaciones/${encodeURIComponent(id)}`;

  return {
    async crear(clavePublica, huellaToken) {
      const r = await pedir("/invitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clavePublica, huellaToken }),
        url: opciones.crearEn,
      });
      // El id va en el enlace que se comparte: solo uno con la forma de un id del servicio.
      return json(r, (c) => esIdEnlace(c.id) && esNumero(c.caducaEn));
    },

    async info(id) {
      return json(await pedir(enlace(id)), (c) => esTexto(c.clavePublica) && esNumero(c.caducaEn));
    },

    async aportar(id, paquete) {
      const r = await pedir(`${enlace(id)}/aportaciones`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: paquete });
      return json(r, (c) => esTexto(c.id));
    },

    async listar(id, token) {
      const r = await pedir(`${enlace(id)}/aportaciones`, { token });
      return json(
        r,
        (c) =>
          esNumero(c.caducaEn) &&
          Array.isArray(c.aportaciones) &&
          c.aportaciones.every((a: unknown) => {
            const x = a as Record<string, unknown> | null;
            return !!x && esTexto(x.id) && esNumero(x.bytes) && esNumero(x.recibidaEn);
          }),
      );
    },

    async descargar(id, aportacion, token) {
      const r = await pedir(`${enlace(id)}/aportaciones/${encodeURIComponent(aportacion)}`, { token });
      return new Uint8Array(await r.arrayBuffer());
    },

    async quitar(id, aportacion, token) {
      await pedir(`${enlace(id)}/aportaciones/${encodeURIComponent(aportacion)}`, { method: "DELETE", token });
    },

    async cerrar(id, token) {
      await pedir(enlace(id), { method: "DELETE", token });
    },
  };
}
