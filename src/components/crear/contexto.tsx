"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cotizar, normalizarSeleccion, type Cotizacion } from "@/domain/precios/cotizar";
import type { Catalogo } from "@/domain/precios/tipos";
import { useMazo } from "@/lib/mazo/contexto";
import { iconosDelMazo } from "@/lib/mazo/derivados";
import type { Paso } from "@/lib/mazo/tipos";

interface ValorCrear {
  catalogo: Catalogo;
  cotizacion: Cotizacion | null;
  iconos: Map<string, string>;
  /** Carta abierta en el paso 2. */
  cartaActiva: string | null;
  setCartaActiva: (id: string | null) => void;
  irAPaso: (p: Paso, cartaId?: string) => void;
  /** Versión por foto, para refrescar vistas tras girarla. */
  versiones: Record<string, number>;
  tocarVersion: (id: string) => void;
}

const Ctx = createContext<ValorCrear | null>(null);

export function ProveedorCrear({ catalogo, children }: { catalogo: Catalogo; children: ReactNode }) {
  const { mazo, despachar } = useMazo();
  const [cartaActiva, setCartaActiva] = useState<string | null>(null);
  const [versiones, setVersiones] = useState<Record<string, number>>({});

  // Pack, extras o mecánicas retirados del catálogo (por ejemplo, en un mazo guardado con una
  // versión anterior) se cambian por los vigentes en cuanto se abre el configurador.
  const seleccion = useMemo(
    () => (mazo ? normalizarSeleccion({ packId: mazo.packId, extras: mazo.extras, mecanicas: mazo.mecanicas }, catalogo) : null),
    [mazo, catalogo],
  );
  useEffect(() => {
    if (seleccion?.cambiado) despachar({ tipo: "normalizarSeleccion", packId: seleccion.packId, extras: seleccion.extras, mecanicas: seleccion.mecanicas });
  }, [seleccion, despachar]);

  const cotizacion = useMemo(() => {
    if (!mazo || !seleccion) return null;
    try {
      return cotizar({ catalogo, packId: seleccion.packId, cartas: mazo.cartas.length, extras: seleccion.extras, mecanicas: seleccion.mecanicas });
    } catch {
      return null;
    }
  }, [mazo, seleccion, catalogo]);

  const iconos = useMemo(() => (mazo ? iconosDelMazo(mazo, catalogo) : new Map<string, string>()), [mazo, catalogo]);

  const valor = useMemo<ValorCrear>(
    () => ({
      catalogo,
      cotizacion,
      iconos,
      cartaActiva,
      setCartaActiva,
      irAPaso: (p, cartaId) => {
        if (cartaId) setCartaActiva(cartaId);
        despachar({ tipo: "cambiar", campo: "paso", valor: p });
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      },
      versiones,
      tocarVersion: (id) => setVersiones((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 })),
    }),
    [catalogo, cotizacion, iconos, cartaActiva, despachar, versiones],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCrear(): ValorCrear {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCrear fuera de ProveedorCrear");
  return v;
}
