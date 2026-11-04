import { conPrecision, type FechaCarta } from "@/domain/fechas/fecha";
import { ordenarPorFecha } from "@/domain/mazo/ordenar";
import { obtenerEstilo, obtenerTinta } from "@/lib/estilos";
import type { CampoMazo, Carta, Mazo, Pedido } from "./tipos";

export interface EstadoMazo {
  estado: "cargando" | "listo";
  mazo: Mazo | null;
  /** Estados anteriores para «Deshacer». */
  pasado: Mazo[];
}

export type Accion =
  | { tipo: "cargar"; mazo: Mazo | null }
  | {
      tipo: "crear";
      id: string;
      ahora: number;
      packId: string;
      estiloId: string;
      idiomaMazo: string;
      mecanicas: string[];
      titulo: string;
    }
  | { tipo: "consentir"; ahora: number }
  | { tipo: "anadirCartas"; cartas: Carta[] }
  | { tipo: "actualizarCarta"; id: string; cambios: Partial<Carta>; deshacible?: boolean }
  | { tipo: "puntoDeshacer" }
  | { tipo: "borrarCartas"; ids: string[] }
  | { tipo: "ponerFecha"; ids: string[]; fecha: FechaCarta }
  | { tipo: "confirmarFecha"; id: string }
  | { tipo: "ordenarPorFecha" }
  | { tipo: "cambiar"; campo: CampoMazo; valor: Mazo[CampoMazo] }
  | { tipo: "registrarPedido"; pedido: Pedido }
  | { tipo: "deshacer" }
  | { tipo: "reiniciar" };

const MAX_HISTORIAL = 40;

export const ESTADO_INICIAL: EstadoMazo = { estado: "cargando", mazo: null, pasado: [] };

function conHistorial(e: EstadoMazo, nuevo: Mazo, deshacible = true): EstadoMazo {
  const mazo = { ...nuevo, actualizadoEn: Date.now() };
  if (!deshacible || !e.mazo) return { ...e, mazo };
  return { ...e, mazo, pasado: [...e.pasado, e.mazo].slice(-MAX_HISTORIAL) };
}

export function reductor(e: EstadoMazo, a: Accion): EstadoMazo {
  if (a.tipo === "cargar") return { estado: "listo", mazo: a.mazo, pasado: [] };
  if (a.tipo === "reiniciar") return { estado: "listo", mazo: null, pasado: [] };
  if (a.tipo === "crear") {
    const estilo = obtenerEstilo(a.estiloId);
    const mazo: Mazo = {
      version: 1,
      id: a.id,
      creadoEn: a.ahora,
      actualizadoEn: a.ahora,
      packId: a.packId,
      estiloId: estilo.id,
      tintaId: obtenerTinta(estilo, null).id,
      titulo: a.titulo,
      dedicatoria: "",
      portadaId: null,
      tono: "original",
      idiomaMazo: a.idiomaMazo,
      mecanicas: a.mecanicas,
      extras: [],
      consentimientoFotos: null,
      paso: 1,
      cartas: [],
      pedido: null,
    };
    return { estado: "listo", mazo, pasado: [] };
  }
  const m = e.mazo;
  if (!m) return e;

  switch (a.tipo) {
    case "consentir":
      return conHistorial(e, { ...m, consentimientoFotos: a.ahora }, false);
    case "anadirCartas":
      return conHistorial(e, { ...m, cartas: [...m.cartas, ...a.cartas] }, false);
    case "actualizarCarta":
      return conHistorial(
        e,
        { ...m, cartas: m.cartas.map((c) => (c.id === a.id ? { ...c, ...a.cambios } : c)) },
        a.deshacible !== false,
      );
    case "puntoDeshacer":
      return { ...e, pasado: [...e.pasado, m].slice(-MAX_HISTORIAL) };
    case "borrarCartas": {
      const ids = new Set(a.ids);
      return conHistorial(e, {
        ...m,
        cartas: m.cartas.filter((c) => !ids.has(c.id)),
        portadaId: m.portadaId && ids.has(m.portadaId) ? null : m.portadaId,
      });
    }
    case "ponerFecha": {
      const ids = new Set(a.ids);
      return conHistorial(e, {
        ...m,
        cartas: m.cartas.map((c) =>
          ids.has(c.id) ? { ...c, fecha: a.fecha, fuente: "manual", confianza: "alta", revisar: false, motivo: undefined } : c,
        ),
      });
    }
    case "confirmarFecha":
      return conHistorial(e, {
        ...m,
        cartas: m.cartas.map((c) => (c.id === a.id ? { ...c, revisar: false, motivo: undefined } : c)),
      });
    case "ordenarPorFecha":
      return conHistorial(e, { ...m, cartas: ordenarPorFecha(m.cartas) });
    case "cambiar": {
      const nuevo = { ...m, [a.campo]: a.valor } as Mazo;
      if (a.campo === "estiloId") nuevo.tintaId = obtenerTinta(obtenerEstilo(String(a.valor)), m.tintaId).id;
      return conHistorial(e, nuevo, a.campo !== "paso" && a.campo !== "titulo" && a.campo !== "dedicatoria");
    }
    case "registrarPedido":
      return conHistorial(e, { ...m, pedido: a.pedido }, false);
    case "deshacer": {
      const anterior = e.pasado[e.pasado.length - 1];
      if (!anterior) return e;
      // El paso actual no se deshace: solo los cambios del mazo.
      return { ...e, mazo: { ...anterior, paso: m.paso, consentimientoFotos: m.consentimientoFotos }, pasado: e.pasado.slice(0, -1) };
    }
  }
  return e;
}

/** Cambia la precisión de la fecha de una carta sin inventar datos. */
export function fechaConPrecision(f: FechaCarta, precision: "anio" | "mes" | "dia", hoy: Date): FechaCarta {
  if (precision === "anio") return conPrecision(f, "anio");
  if (precision === "mes") return { anio: f.anio, mes: f.mes ?? (f.anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 1) };
  return { anio: f.anio, mes: f.mes ?? 1, dia: f.dia ?? 1 };
}
