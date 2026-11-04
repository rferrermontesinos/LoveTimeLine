import { conPrecision, type FechaCarta } from "@/domain/fechas/fecha";
import { ordenarPorFecha } from "@/domain/mazo/ordenar";
import { ESTILO_POR_DEFECTO, obtenerEstilo, obtenerPaleta } from "@/lib/estilos";
import { VERSION_MAZO, type CambiosCarta, type CampoMazo, type Carta, type FotoCaja, type Mazo, type Pedido } from "./tipos";

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
      idiomaMazo: string;
      mecanicas: string[];
      titulo: string;
    }
  | { tipo: "consentir"; ahora: number }
  /**
   * Añade cartas al final. Las importadas (fotos) quedan fuera de «Deshacer»: también se suman a
   * los estados anteriores, para que deshacer otro cambio no las quite. Con `deshacible` (un
   * recuerdo sin foto escrito a mano) es un cambio más, que «Deshacer» quita.
   */
  | { tipo: "anadirCartas"; cartas: Carta[]; deshacible?: boolean }
  | { tipo: "actualizarCarta"; id: string; cambios: CambiosCarta; deshacible?: boolean }
  | { tipo: "actualizarCartas"; ids: string[]; cambios: CambiosCarta }
  | { tipo: "puntoDeshacer" }
  | { tipo: "borrarCartas"; ids: string[] }
  | { tipo: "ponerFecha"; ids: string[]; fecha: FechaCarta }
  /**
   * Usa una fecha sugerida (por defecto, la primera) en cada carta que la tenga. La fecha queda
   * confirmada por el cliente: conserva de dónde salió, con confianza alta. Se puede deshacer.
   */
  | { tipo: "aceptarSugerencia"; ids: string[]; indice?: number }
  | { tipo: "confirmarFecha"; id: string }
  | { tipo: "ordenarPorFecha" }
  | { tipo: "cambiar"; campo: CampoMazo; valor: Mazo[CampoMazo] }
  /** Foto de la caja personalizada (null: la de la portada). */
  | { tipo: "ponerCaja"; caja: FotoCaja | null }
  /**
   * Ajusta pack, extras y mecánicas a lo que ofrece el catálogo (borradores antiguos). No se deshace.
   * `desde` es la selección de la que se calculó: si el mazo ya tiene otra (el arranque acaba de
   * cambiarle el pack, por ejemplo), la acción llega tarde y se descarta; el configurador la vuelve a
   * calcular con el mazo nuevo.
   */
  | { tipo: "normalizarSeleccion"; packId: string; extras: string[]; mecanicas: string[]; desde: SeleccionMazo }
  | { tipo: "registrarPedido"; pedido: Pedido }
  | { tipo: "pedidoPagado" }
  /** Se ha vuelto de Stripe sin pagar: el pedido pendiente se quita (uno pagado no se toca). No se deshace. */
  | { tipo: "cancelarPedido" }
  /** Carta abierta en el paso 2, que se recuerda para volver otro día. No se deshace. */
  | { tipo: "abrirCarta"; id: string | null }
  | { tipo: "deshacer" }
  | { tipo: "reiniciar" };

/** Lo que el catálogo puede retirar: pack, extras y mecánicas del mazo. */
export type SeleccionMazo = Pick<Mazo, "packId" | "extras" | "mecanicas">;

const mismaLista = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function mismaSeleccion(a: SeleccionMazo, b: SeleccionMazo): boolean {
  return a.packId === b.packId && mismaLista(a.extras, b.extras) && mismaLista(a.mecanicas, b.mecanicas);
}

const MAX_HISTORIAL = 40;

export const ESTADO_INICIAL: EstadoMazo = { estado: "cargando", mazo: null, pasado: [] };

/** Campos que tiene toda carta; en las de texto no se aplica nada más. */
const CAMPOS_COMUNES = new Set(["fecha", "fuente", "confianza", "revisar", "motivo", "sugerencias", "descripcion", "destacada", "anadidaEn"]);

export function aplicarCambios(c: Carta, cambios: CambiosCarta): Carta {
  if (c.tipo === "foto") return { ...c, ...cambios };
  const comunes = Object.fromEntries(Object.entries(cambios).filter(([k]) => CAMPOS_COMUNES.has(k)));
  return { ...c, ...comunes };
}

/** Lo que «Deshacer» no toca: el paso y la carta en que estás, el permiso de las fotos y el pedido. */
const FUERA_DE_DESHACER = new Set<string>(["paso", "cartaAbierta", "actualizadoEn", "consentimientoFotos", "pedido"]);

/**
 * Dos versiones del mazo con lo mismo que recupera «Deshacer». Basta comparar referencias: el
 * reductor solo crea objetos nuevos para lo que cambia.
 */
function mismoContenido(a: Mazo, b: Mazo): boolean {
  if (a === b) return true;
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (!FUERA_DE_DESHACER.has(k) && x[k] !== y[k]) return false;
  }
  return true;
}

function conHistorial(e: EstadoMazo, nuevo: Mazo, deshacible = true): EstadoMazo {
  const mazo = { ...nuevo, actualizadoEn: Date.now() };
  if (!deshacible || !e.mazo) return { ...e, mazo };
  return { ...e, mazo, pasado: [...e.pasado, e.mazo].slice(-MAX_HISTORIAL) };
}

export function reductor(e: EstadoMazo, a: Accion): EstadoMazo {
  if (a.tipo === "cargar") return { estado: "listo", mazo: a.mazo, pasado: [] };
  if (a.tipo === "reiniciar") return { estado: "listo", mazo: null, pasado: [] };
  if (a.tipo === "crear") {
    const estilo = ESTILO_POR_DEFECTO;
    const mazo: Mazo = {
      version: VERSION_MAZO,
      id: a.id,
      creadoEn: a.ahora,
      actualizadoEn: a.ahora,
      packId: a.packId,
      estiloId: estilo.id,
      paletaId: obtenerPaleta(estilo, null).id,
      titulo: a.titulo,
      dedicatoria: "",
      portadaId: null,
      caja: null,
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
    case "anadirCartas": {
      const cartas = [...m.cartas, ...a.cartas];
      if (a.deshacible) return conHistorial(e, { ...m, cartas });
      // Los estados que tenían las mismas cartas que ahora comparten la lista nueva: así
      // «Deshacer» sigue reconociendo como iguales los puntos que no cambiaron nada.
      const pasado = e.pasado.map((p) => ({ ...p, cartas: p.cartas === m.cartas ? cartas : [...p.cartas, ...a.cartas] }));
      return { ...conHistorial(e, { ...m, cartas }, false), pasado };
    }
    case "actualizarCarta":
      return conHistorial(
        e,
        { ...m, cartas: m.cartas.map((c) => (c.id === a.id ? aplicarCambios(c, a.cambios) : c)) },
        a.deshacible !== false,
      );
    case "actualizarCartas": {
      const ids = new Set(a.ids);
      return conHistorial(e, { ...m, cartas: m.cartas.map((c) => (ids.has(c.id) ? aplicarCambios(c, a.cambios) : c)) });
    }
    case "puntoDeshacer": {
      // Sin cambios desde el último punto, no se repite (al pasar de un campo a otro).
      const ultimo = e.pasado[e.pasado.length - 1];
      if (ultimo && mismoContenido(ultimo, m)) return e;
      return { ...e, pasado: [...e.pasado, m].slice(-MAX_HISTORIAL) };
    }
    case "borrarCartas": {
      const ids = new Set(a.ids);
      return conHistorial(e, {
        ...m,
        cartas: m.cartas.filter((c) => !ids.has(c.id)),
        portadaId: m.portadaId && ids.has(m.portadaId) ? null : m.portadaId,
        caja: m.caja?.origen === "carta" && ids.has(m.caja.cartaId) ? null : m.caja,
      });
    }
    case "ponerFecha": {
      const ids = new Set(a.ids);
      return conHistorial(e, {
        ...m,
        cartas: m.cartas.map((c) =>
          ids.has(c.id) ? { ...c, fecha: a.fecha, fuente: "manual", confianza: "alta", revisar: false, motivo: undefined, sugerencias: [] } : c,
        ),
      });
    }
    case "aceptarSugerencia": {
      const ids = new Set(a.ids);
      const indice = a.indice ?? 0;
      let aceptadas = 0;
      const cartas = m.cartas.map((c): Carta => {
        const s = ids.has(c.id) ? c.sugerencias?.[indice] : undefined;
        if (!s) return c;
        aceptadas++;
        return { ...c, fecha: s.fecha, fuente: s.fuente, confianza: "alta", revisar: false, motivo: undefined, sugerencias: [] };
      });
      return aceptadas ? conHistorial(e, { ...m, cartas }) : e;
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
      // Estilo y paleta siempre existentes: si no, vuelven a los de por defecto.
      if (a.campo === "estiloId") {
        const estilo = obtenerEstilo(String(a.valor));
        nuevo.estiloId = estilo.id;
        nuevo.paletaId = obtenerPaleta(estilo, m.paletaId).id;
      }
      if (a.campo === "paletaId") nuevo.paletaId = obtenerPaleta(obtenerEstilo(m.estiloId), String(a.valor)).id;
      return conHistorial(e, nuevo, a.campo !== "paso" && a.campo !== "titulo" && a.campo !== "dedicatoria");
    }
    case "ponerCaja":
      return conHistorial(e, { ...m, caja: a.caja });
    case "normalizarSeleccion":
      if (!mismaSeleccion(m, a.desde)) return e;
      return conHistorial(e, { ...m, packId: a.packId, extras: a.extras, mecanicas: a.mecanicas }, false);
    case "registrarPedido":
      return conHistorial(e, { ...m, pedido: a.pedido }, false);
    case "pedidoPagado":
      return m.pedido ? conHistorial(e, { ...m, pedido: { ...m.pedido, estado: "pagado" } }, false) : e;
    case "cancelarPedido":
      return m.pedido?.estado === "pendiente" ? conHistorial(e, { ...m, pedido: null }, false) : e;
    case "abrirCarta":
      return (m.cartaAbierta ?? null) === a.id ? e : conHistorial(e, { ...m, cartaAbierta: a.id }, false);
    case "deshacer": {
      // Los puntos que no cambiaron nada (entrar en un campo y salir sin tocarlo) se saltan:
      // cada «Deshacer» recupera algo que se ve.
      let i = e.pasado.length - 1;
      while (i >= 0 && mismoContenido(e.pasado[i]!, m)) i--;
      const anterior = e.pasado[i];
      if (!anterior) return e.pasado.length ? { ...e, pasado: [] } : e;
      // El paso actual no se deshace: solo los cambios del mazo.
      return {
        ...e,
        mazo: { ...anterior, paso: m.paso, cartaAbierta: m.cartaAbierta, consentimientoFotos: m.consentimientoFotos, pedido: m.pedido },
        pasado: e.pasado.slice(0, i),
      };
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
