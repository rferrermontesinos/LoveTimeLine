/**
 * Almacén de la subida colaborativa para desarrollo y pruebas: en memoria o, con `carpeta`, en
 * disco (`.colaboracion-local/`, fuera de git). Hace lo mismo que las funciones colab_* de la
 * migración de Supabase, con los mismos límites, para que las pruebas cubran el servicio real.
 * Nunca se usa en producción: la ruta que lo sirve solo responde con COLABORACION_LOCAL=1.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Almacen, AportacionGuardada, InvitacionGuardada, Limites, ResultadoReserva } from "@datos/functions/colaboracion/servicio";

interface Estado {
  invitaciones: Record<string, InvitacionGuardada & { creadaEn: number }>;
  aportaciones: Record<string, (AportacionGuardada & { lista: boolean })[]>;
}

const RUTA = /^[A-Za-z0-9_-]{22}(\/[A-Za-z0-9_-]{22})?$/;
const HORA = 60 * 60 * 1000;

function rutaSegura(r: string): string {
  if (!RUTA.test(r)) throw new Error("ruta no válida");
  return r;
}

export function almacenLocal(opciones: { carpeta?: string; ahora?: () => number } = {}): Almacen {
  const ahora = opciones.ahora ?? (() => Date.now());
  const { carpeta } = opciones;
  const archivosEnMemoria = new Map<string, Uint8Array<ArrayBuffer>>();
  let estado: Estado | null = null;
  let cola: Promise<unknown> = Promise.resolve();

  /** Una operación detrás de otra: así la reserva comprueba y apunta sin que otra se cuele. */
  function enOrden<T>(f: (e: Estado) => T): Promise<T> {
    const r = cola.then(async () => {
      const e = await cargar();
      const valor = f(e);
      await guardar(e);
      return valor;
    });
    cola = r.catch(() => undefined);
    return r;
  }

  async function cargar(): Promise<Estado> {
    if (estado) return estado;
    if (carpeta) {
      try {
        estado = JSON.parse(await readFile(path.join(carpeta, "estado.json"), "utf8")) as Estado;
      } catch {
        estado = null;
      }
    }
    estado ??= { invitaciones: {}, aportaciones: {} };
    return estado;
  }

  async function guardar(e: Estado): Promise<void> {
    if (!carpeta) return;
    await mkdir(carpeta, { recursive: true });
    await writeFile(path.join(carpeta, "estado.json"), JSON.stringify(e));
  }

  const archivo = (r: string) => path.join(carpeta!, "archivos", rutaSegura(r));
  const bytesDe = (lista: AportacionGuardada[] | undefined) => (lista ?? []).reduce((n, a) => n + a.bytes, 0);

  return {
    crear: (inv, l: Limites) =>
      enOrden((e) => {
        const t = ahora();
        const todas = Object.values(e.invitaciones);
        if (todas.filter((i) => i.caducaEn > t).length >= l.maxEnlacesActivos) return "lleno" as const;
        if (todas.filter((i) => i.creadaEn > t - HORA).length >= l.maxEnlacesPorHora) return "lleno" as const;
        e.invitaciones[inv.id] = { clavePublica: inv.clavePublica, huellaToken: inv.huellaToken, caducaEn: inv.caducaEn, creadaEn: t };
        e.aportaciones[inv.id] = [];
        return "ok" as const;
      }),

    leer: (id) =>
      enOrden((e) => {
        const i = e.invitaciones[id];
        return i ? { clavePublica: i.clavePublica, huellaToken: i.huellaToken, caducaEn: i.caducaEn } : null;
      }),

    reservar: (inv, id, bytes, l: Limites) =>
      enOrden((e): ResultadoReserva => {
        const i = e.invitaciones[inv];
        if (!i) return "no-existe";
        const t = ahora();
        if (i.caducaEn <= t) return "caducada";
        // Las reservas que se quedaron a medias hace más de una hora ya no cuentan.
        const lista = (e.aportaciones[inv] ?? []).filter((a) => a.lista || a.recibidaEn > t - HORA);
        const total = Object.values(e.aportaciones).reduce((n, a) => n + bytesDe(a), 0);
        if (lista.length >= l.maxFotos || bytesDe(lista) + bytes > l.maxBytesEnlace || total + bytes > l.maxBytesTotal) return "lleno";
        e.aportaciones[inv] = [...lista, { id, bytes, recibidaEn: t, lista: false }];
        return "ok";
      }),

    confirmar: (inv, id) =>
      enOrden((e) => {
        for (const a of e.aportaciones[inv] ?? []) if (a.id === id) a.lista = true;
      }),

    quitar: (inv, id) =>
      enOrden((e) => {
        const antes = e.aportaciones[inv] ?? [];
        e.aportaciones[inv] = antes.filter((a) => a.id !== id);
        return e.aportaciones[inv]!.length !== antes.length;
      }),

    listar: (inv) =>
      enOrden((e) =>
        (e.aportaciones[inv] ?? [])
          .filter((a) => a.lista)
          .sort((a, b) => a.recibidaEn - b.recibidaEn || a.id.localeCompare(b.id))
          .map(({ id, bytes, recibidaEn }) => ({ id, bytes, recibidaEn })),
      ),

    borrarInvitacion: (inv) =>
      enOrden((e) => {
        delete e.invitaciones[inv];
        delete e.aportaciones[inv];
      }),

    caducadas: (limite) =>
      enOrden((e) => {
        const t = ahora();
        return Object.entries(e.invitaciones)
          .filter(([, i]) => i.caducaEn <= t)
          .sort((a, b) => a[1].caducaEn - b[1].caducaEn)
          .slice(0, limite)
          .map(([id]) => id);
      }),

    async subirArchivo(r, datos) {
      if (!carpeta) {
        archivosEnMemoria.set(rutaSegura(r), new Uint8Array(datos));
        return;
      }
      await mkdir(path.dirname(archivo(r)), { recursive: true });
      await writeFile(archivo(r), datos, { flag: "wx" });
    },

    async bajarArchivo(r) {
      if (!carpeta) {
        const datos = archivosEnMemoria.get(rutaSegura(r));
        return datos ? new Uint8Array(datos) : null;
      }
      try {
        return new Uint8Array(await readFile(archivo(r)));
      } catch {
        return null;
      }
    },

    async borrarArchivos(rutas) {
      for (const r of rutas) {
        if (!carpeta) archivosEnMemoria.delete(rutaSegura(r));
        else await rm(archivo(r), { force: true });
      }
    },

    async listarArchivos(c) {
      if (!carpeta) return [...archivosEnMemoria.keys()].filter((k) => k.startsWith(`${rutaSegura(c)}/`));
      try {
        return (await readdir(path.join(carpeta, "archivos", rutaSegura(c)))).map((n) => `${c}/${n}`);
      } catch {
        return [];
      }
    },
  };
}
