"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { almacenDisponible, borrarTodo, cargarMazo, guardarMazo, limpiarHuerfanas } from "@/lib/almacen/idb";
import { ESTADO_INICIAL, reductor, type Accion, type EstadoMazo } from "./reductor";

interface ValorContexto extends EstadoMazo {
  despachar: (a: Accion) => void;
  puedeDeshacer: boolean;
  almacenOk: boolean;
  reiniciarTodo: () => Promise<void>;
}

const Contexto = createContext<ValorContexto | null>(null);

export function ProveedorMazo({ children }: { children: ReactNode }) {
  const [estado, despachar] = useReducer(reductor, ESTADO_INICIAL);
  const [almacenOk, setAlmacenOk] = useState(true);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cargado = useRef(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const ok = await almacenDisponible();
      const mazo = ok ? await cargarMazo() : null;
      if (!vivo) return;
      setAlmacenOk(ok);
      despachar({ tipo: "cargar", mazo });
      cargado.current = true;
      if (mazo) void limpiarHuerfanas(new Set(mazo.cartas.map((c) => c.id)));
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Guardado automático, sin bloquear la interfaz.
  useEffect(() => {
    if (!cargado.current || estado.estado !== "listo") return;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void guardarMazo(estado.mazo), 350);
  }, [estado.mazo, estado.estado]);

  // Guardar antes de cerrar la pestaña.
  useEffect(() => {
    const alSalir = () => {
      if (cargado.current) void guardarMazo(estado.mazo);
    };
    window.addEventListener("pagehide", alSalir);
    return () => window.removeEventListener("pagehide", alSalir);
  }, [estado.mazo]);

  const reiniciarTodo = useCallback(async () => {
    await borrarTodo();
    despachar({ tipo: "reiniciar" });
  }, []);

  const valor = useMemo<ValorContexto>(
    () => ({ ...estado, despachar, puedeDeshacer: estado.pasado.length > 0, almacenOk, reiniciarTodo }),
    [estado, almacenOk, reiniciarTodo],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useMazo(): ValorContexto {
  const v = useContext(Contexto);
  if (!v) throw new Error("useMazo fuera de ProveedorMazo");
  return v;
}
