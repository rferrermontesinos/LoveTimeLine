"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cartasPendientes, puedeIrAEstilo, siguientePendiente } from "@/domain/mazo/configuracion";
import { cotizar, normalizarSeleccion, type Cotizacion } from "@/domain/precios/cotizar";
import type { Catalogo } from "@/domain/precios/tipos";
import { accionNormalizar } from "@/lib/mazo/arranque";
import { useMazo } from "@/lib/mazo/contexto";
import { iconosDelMazo } from "@/lib/mazo/derivados";
import type { Paso } from "@/lib/mazo/tipos";

interface ValorCrear {
  catalogo: Catalogo;
  cotizacion: Cotizacion | null;
  iconos: Map<string, string>;
  /** Hoy, para las reglas de fechas (se fija al abrir el configurador). */
  hoy: Date;
  /** Ids de las cartas por completar, en el orden del mazo. */
  pendientes: string[];
  /** Todas las cartas están listas (y hay al menos una): se puede pasar a Estilo y Pedido. */
  puedeAvanzar: boolean;
  /** Paso que se muestra: el guardado, como mucho el permitido. */
  pasoActual: Paso;
  /** Carta abierta en el paso 2. Se guarda con el mazo: al volver otro día, sigue abierta. */
  cartaActiva: string | null;
  setCartaActiva: (id: string | null) => void;
  /**
   * Cambia de paso. A Estilo o Pedido con cartas pendientes, lleva a la primera pendiente. Con
   * `ancla`, el paso nuevo lleva a ese bloque en vez de empezar arriba (por ejemplo, «caja»).
   */
  irAPaso: (p: Paso, cartaId?: string, ancla?: AnclaPaso) => void;
  /** Bloque al que ha pedido ir el último cambio de paso, si alguno. */
  ancla: AnclaPaso | null;
  /**
   * Abre en el paso 2 la siguiente carta pendiente después de la indicada (o la primera). Desde
   * otro paso, la página empieza arriba; dentro del paso 2, sube `avisoFecha`.
   */
  irASiguientePendiente: (desdeId?: string | null) => void;
  /**
   * Cuántas veces se ha ido a una carta pendiente sin salir del paso 2. Cuando cambia, el paso de
   * cartas trae a la vista la fecha de esa carta, que es lo que le falta.
   */
  avisoFecha: number;
  /** Versión por foto, para refrescar vistas tras girarla. */
  versiones: Record<string, number>;
  tocarVersion: (id: string) => void;
  /**
   * Diálogo para añadir un recuerdo sin foto (con la idea elegida, si la hay). Sigue montado al
   * cerrarse, para que el diálogo nativo se cierre y devuelva el foco a quien lo abrió.
   */
  recuerdo: { idea: string; clave: number; abierto: boolean } | null;
  abrirRecuerdo: (idea?: string) => void;
  /** Cierra el diálogo; con la carta que se acaba de añadir, la apunta para confirmarlo en pantalla. */
  cerrarRecuerdo: (anadido?: RecuerdoAnadido) => void;
  /** El último recuerdo sin foto añadido en esta visita. */
  recuerdoAnadido: RecuerdoAnadido | null;
}

export interface RecuerdoAnadido {
  id: string;
  texto: string;
}

/** Bloques a los que se puede llevar desde otro paso. */
export type AnclaPaso = "caja";

const Ctx = createContext<ValorCrear | null>(null);

/** Desplazamiento suave, salvo si la persona ha pedido menos movimiento en su sistema. */
export function desplazamiento(): ScrollBehavior {
  if (typeof window === "undefined" || !window.matchMedia) return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function subir() {
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: desplazamiento() });
}

export function ProveedorCrear({ catalogo, children }: { catalogo: Catalogo; children: ReactNode }) {
  const { mazo, despachar } = useMazo();
  const cartaActiva = mazo?.cartaAbierta ?? null;
  const setCartaActiva = useCallback((id: string | null) => despachar({ tipo: "abrirCarta", id }), [despachar]);
  const [versiones, setVersiones] = useState<Record<string, number>>({});
  const [avisoFecha, setAvisoFecha] = useState(0);
  const [ancla, setAncla] = useState<AnclaPaso | null>(null);
  const [recuerdo, setRecuerdo] = useState<{ idea: string; clave: number; abierto: boolean } | null>(null);
  const [recuerdoAnadido, setRecuerdoAnadido] = useState<RecuerdoAnadido | null>(null);
  const [hoy] = useState(() => new Date());

  // Pack, extras o mecánicas retirados del catálogo (por ejemplo, en un mazo guardado con una
  // versión anterior) se cambian por los vigentes en cuanto se abre el configurador.
  const seleccion = useMemo(
    () => (mazo ? normalizarSeleccion({ packId: mazo.packId, extras: mazo.extras, mecanicas: mazo.mecanicas }, catalogo) : null),
    [mazo, catalogo],
  );
  // La acción lleva la selección de la que parte: si el arranque cambia el pack en este mismo
  // instante, el reductor la descarta y este efecto la vuelve a calcular con el mazo nuevo.
  const normalizar = useMemo(() => (mazo && seleccion?.cambiado ? accionNormalizar(mazo, catalogo) : null), [mazo, seleccion, catalogo]);
  useEffect(() => {
    if (normalizar) despachar(normalizar);
  }, [normalizar, despachar]);

  const cotizacion = useMemo(() => {
    if (!mazo || !seleccion) return null;
    try {
      return cotizar({ catalogo, packId: seleccion.packId, cartas: mazo.cartas.length, extras: seleccion.extras, mecanicas: seleccion.mecanicas });
    } catch {
      return null;
    }
  }, [mazo, seleccion, catalogo]);

  const iconos = useMemo(() => (mazo ? iconosDelMazo(mazo, catalogo) : new Map<string, string>()), [mazo, catalogo]);

  // La regla de paso, en un solo sitio: a Estilo y Pedido solo con todas las cartas listas.
  const cartas = mazo?.cartas;
  const pendientes = useMemo(() => (cartas ? cartasPendientes(cartas, hoy) : []), [cartas, hoy]);
  const puedeAvanzar = useMemo(() => !!cartas && puedeIrAEstilo(cartas, hoy), [cartas, hoy]);
  const pasoMax: Paso = puedeAvanzar ? 4 : 2;
  const pasoGuardado = mazo?.paso ?? 1;
  const pasoActual = Math.min(pasoGuardado, pasoMax) as Paso;

  // Un paso guardado más allá del permitido (al volver otro día, al deshacer en Estilo…) se
  // corrige, para que no salte solo a Estilo al completar la última carta.
  useEffect(() => {
    if (pasoGuardado > pasoMax) despachar({ tipo: "cambiar", campo: "paso", valor: pasoMax });
  }, [pasoGuardado, pasoMax, despachar]);

  const valor = useMemo<ValorCrear>(
    () => ({
      catalogo,
      cotizacion,
      iconos,
      hoy,
      pendientes,
      puedeAvanzar,
      pasoActual,
      cartaActiva,
      setCartaActiva,
      irAPaso: (p, cartaId, anclaPedida) => {
        const bloqueado = p > pasoMax;
        const destino = bloqueado ? pasoMax : p;
        const carta = cartaId ?? (bloqueado ? pendientes[0] : undefined);
        if (carta) setCartaActiva(carta);
        const conAncla = !bloqueado && anclaPedida ? anclaPedida : null;
        setAncla(conAncla);
        despachar({ tipo: "cambiar", campo: "paso", valor: destino });
        // Con ancla, el paso de destino se encarga de llevar a su bloque.
        if (!conAncla) subir();
      },
      ancla,
      irASiguientePendiente: (desdeId) => {
        if (!cartas) return;
        const desde = desdeId ? cartas.findIndex((c) => c.id === desdeId) : -1;
        const i = siguientePendiente(cartas, desde, hoy);
        if (i < 0) return;
        setCartaActiva(cartas[i]!.id);
        if (pasoGuardado !== 2) despachar({ tipo: "cambiar", campo: "paso", valor: 2 });
        if (pasoActual === 2) setAvisoFecha((n) => n + 1);
        else subir();
      },
      avisoFecha,
      versiones,
      tocarVersion: (id) => setVersiones((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 })),
      recuerdo,
      // La clave cambia en cada apertura: el diálogo empieza de cero cada vez.
      abrirRecuerdo: (idea) => setRecuerdo((r) => ({ idea: idea ?? "", clave: (r?.clave ?? 0) + 1, abierto: true })),
      cerrarRecuerdo: (anadido) => {
        setRecuerdo((r) => (r ? { ...r, abierto: false } : r));
        if (anadido) setRecuerdoAnadido(anadido);
      },
      recuerdoAnadido,
    }),
    [catalogo, cotizacion, iconos, hoy, pendientes, puedeAvanzar, pasoActual, pasoMax, pasoGuardado, cartas, cartaActiva, setCartaActiva, despachar, avisoFecha, versiones, ancla, recuerdo, recuerdoAnadido],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCrear(): ValorCrear {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCrear fuera de ProveedorCrear");
  return v;
}
