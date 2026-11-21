/**
 * Aviso entre pestañas del mismo navegador que tienen el mazo abierto (BroadcastChannel), para
 * que no se pisen: la que guarda avisa a las demás, que traen lo nuevo o avisan del conflicto; y
 * una pestaña que se abre pregunta si hay otras antes de limpiar fotos sueltas del almacén (otra
 * podría estar subiendo fotos que aún no son cartas guardadas). Sin BroadcastChannel no pasa
 * nada: queda la comprobación antes de escribir (ver guardado.ts).
 */
import { versionDe, type VersionMazo } from "./guardado";

export type MensajePestana =
  /** Acabo de guardar esta versión del mazo. */
  | { tipo: "guardado"; pestana: string; version: VersionMazo }
  /** Me acabo de abrir: ¿hay alguien más? */
  | { tipo: "hola"; pestana: string }
  /** Respuesta a «hola»: yo también tengo el mazo abierto. */
  | { tipo: "aqui"; pestana: string };

const NOMBRE_CANAL = "baraja-recuerdos:mazo";

/** Lee un mensaje recibido; null si no es uno de los nuestros. */
export function leerMensaje(datos: unknown): MensajePestana | null {
  if (!datos || typeof datos !== "object") return null;
  const m = datos as Record<string, unknown>;
  if (typeof m.pestana !== "string" || !m.pestana) return null;
  if (m.tipo === "hola" || m.tipo === "aqui") return { tipo: m.tipo, pestana: m.pestana };
  if (m.tipo === "guardado") {
    const version = versionDe(m.version);
    return version ? { tipo: "guardado", pestana: m.pestana, version } : null;
  }
  return null;
}

/** Identificador de esta pestaña (de esta carga de página). */
export function idPestana(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface CanalPestanas {
  enviar: (m: MensajePestana) => void;
  cerrar: () => void;
}

/**
 * Abre el canal. `alRecibir` solo recibe los mensajes válidos de otras pestañas. Null si el
 * navegador no tiene BroadcastChannel.
 */
export function abrirCanal(pestana: string, alRecibir: (m: MensajePestana) => void): CanalPestanas | null {
  if (typeof BroadcastChannel === "undefined") return null;
  let canal: BroadcastChannel;
  try {
    canal = new BroadcastChannel(NOMBRE_CANAL);
  } catch {
    return null;
  }
  canal.onmessage = (e: MessageEvent) => {
    const m = leerMensaje(e.data);
    if (m && m.pestana !== pestana) alRecibir(m);
  };
  return {
    enviar: (m) => {
      try {
        canal.postMessage(m);
      } catch {
        /* canal cerrado: la otra pestaña lo verá al escribir */
      }
    },
    cerrar: () => canal.close(),
  };
}
