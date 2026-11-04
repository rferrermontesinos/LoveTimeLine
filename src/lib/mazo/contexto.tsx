"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { almacenDisponible, borrarFotos, borrarTodo, cargarMazo, escribirMazo, idsDeFotos } from "@/lib/almacen/idb";
import { pedirAlmacenPersistente } from "@/lib/almacen/persistencia";
import { fotosSueltas } from "./derivados";
import {
  conVistaDeEstaPestana,
  debePedirPersistencia,
  decidirSincronizacion,
  guardarSinEsperar,
  sinNadaQuePerder,
  versionDe,
  type EstadoGuardado,
  type VersionMazo,
} from "./guardado";
import { abrirCanal, idPestana, type CanalPestanas } from "./pestanas";
import { ESTADO_INICIAL, reductor, type Accion, type EstadoMazo } from "./reductor";
import type { Mazo } from "./tipos";

interface ValorContexto extends EstadoMazo {
  despachar: (a: Accion) => void;
  puedeDeshacer: boolean;
  almacenOk: boolean;
  /** Cómo va el guardado en este dispositivo, para enseñarlo. */
  guardado: EstadoGuardado;
  /** El mazo tal como estaba guardado al abrir la página (null si no había): para «Seguimos donde lo dejaste». */
  alAbrir: Mazo | null;
  reiniciarTodo: () => Promise<void>;
  /** Guarda ya, sin esperar al guardado automático (antes de salir hacia el pago). */
  guardarAhora: (mazo?: Mazo | null) => Promise<void>;
  /**
   * Trae lo guardado (tras cambiar el mazo en otra pestaña) y vuelve a guardar desde ahí. Si allí
   * se borró sin empezar otro, lo de esta pestaña pasa a ser lo guardado.
   */
  recargar: () => Promise<void>;
}

const Contexto = createContext<ValorContexto | null>(null);

/** Espera antes de guardar tras un cambio: agrupa los cambios seguidos (al escribir, por ejemplo). */
const ESPERA_GUARDADO_MS = 350;
/** Con cambios seguidos sin pausa, se guarda al menos cada tanto. */
const ESPERA_MAXIMA_MS = 2000;
/** Lo que se espera a que otras pestañas digan «aquí estoy» antes de limpiar fotos sueltas. */
const ESPERA_OTRAS_PESTANAS_MS = 600;

/**
 * El mazo de este dispositivo: lo lee de IndexedDB al abrir y lo guarda al poco de cada cambio,
 * al ocultar la página y al salir. Antes de escribir comprueba que nadie lo ha cambiado desde la
 * última vez (otra pestaña): si es así, no lo pisa; trae lo nuevo si aquí no había cambios o, si
 * los había, deja de guardar y lo avisa (`guardado.tipo === "conflicto"`).
 */
export function ProveedorMazo({ children }: { children: ReactNode }) {
  const [estado, despacharAlReductor] = useReducer(reductor, ESTADO_INICIAL);
  /** El último cambio apunta a fotos ya escritas en el almacén: se guarda sin esperar. */
  const sinEsperar = useRef(false);
  const despachar = useCallback((a: Accion) => {
    if (guardarSinEsperar(a)) sinEsperar.current = true;
    despacharAlReductor(a);
  }, []);
  const [almacenOk, setAlmacenOk] = useState(true);
  const [guardado, setGuardado] = useState<EstadoGuardado>({ tipo: "guardando" });
  const [alAbrir, setAlAbrir] = useState<Mazo | null>(null);
  /** El último mazo leído o escrito (como `escrito`, pero para pintar): si no es el actual, hay cambios sin guardar. */
  const [enDispositivo, setEnDispositivo] = useState<Mazo | null>(null);

  const cargado = useRef(false);
  /** El navegador no deja usar IndexedDB: no se intenta escribir. */
  const sinAlmacen = useRef(false);
  const pestana = useRef("");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Desde cuándo hay cambios sin guardar (para no esperar más de ESPERA_MAXIMA_MS). */
  const pendienteDesde = useRef<number | null>(null);
  /** El mazo más reciente de esta pestaña (el del reductor o el que se pidió guardar ya). */
  const ultimo = useRef<Mazo | null>(null);
  /** La última versión que esta pestaña leyó del almacén o escribió en él. */
  const base = useRef<VersionMazo | null>(null);
  /** El último mazo leído o escrito, tal cual: si el actual es este mismo objeto, no hay nada nuevo. */
  const escrito = useRef<Mazo | null>(null);
  /** Otra pestaña ha cambiado el mazo: aquí no se guarda hasta que la persona elija. */
  const enConflicto = useRef(false);
  const canal = useRef<CanalPestanas | null>(null);
  const hayOtras = useRef(false);
  /** Lecturas y escrituras de una en una, para que la comprobación de versión no se cruce consigo misma. */
  const cola = useRef<Promise<void>>(Promise.resolve());

  const encolar = useCallback((tarea: () => Promise<void>): Promise<void> => {
    const siguiente = cola.current.then(tarea);
    cola.current = siguiente.catch(() => undefined);
    return siguiente;
  }, []);

  /** Apunta qué mazo está ya en el dispositivo, tal cual. */
  const marcarEscrito = useCallback((m: Mazo | null) => {
    escrito.current = m;
    setEnDispositivo(m);
  }, []);

  const pararTemporizador = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    pendienteDesde.current = null;
  };

  /**
   * Deja esta pestaña con el mazo guardado (por otra) como punto de partida, sin moverla del paso
   * y la carta en que está. La versión es la guardada: lo que se queda de aquí no es un cambio.
   */
  const tomarGuardado = useCallback((guardadoAhora: Mazo) => {
    const m = conVistaDeEstaPestana(guardadoAhora, ultimo.current);
    base.current = versionDe(guardadoAhora);
    marcarEscrito(m);
    ultimo.current = m;
    enConflicto.current = false;
    despacharAlReductor({ tipo: "cargar", mazo: m });
    setGuardado({ tipo: "guardado", en: guardadoAhora.actualizadoEn });
  }, [marcarEscrito]);

  const avisarConflicto = useCallback((guardadoAhora: VersionMazo | null) => {
    enConflicto.current = true;
    pararTemporizador();
    setGuardado({ tipo: "conflicto", otroMazo: guardadoAhora?.id !== ultimo.current?.id });
  }, []);

  const escribir = useCallback(
    () =>
      encolar(async () => {
        const mazo = ultimo.current;
        if (!cargado.current || sinAlmacen.current || enConflicto.current || !mazo || mazo === escrito.current) return;
        const r = await escribirMazo(mazo, base.current);
        if (r.ok) {
          base.current = versionDe(mazo);
          marcarEscrito(mazo);
          setGuardado({ tipo: "guardado", en: Date.now() });
          if (base.current) canal.current?.enviar({ tipo: "guardado", pestana: pestana.current, version: base.current });
        } else if (r.motivo === "conflicto") avisarConflicto(r.guardado);
        else setGuardado({ tipo: r.motivo === "espacio" ? "sin-espacio" : "error" });
      }),
    [encolar, avisarConflicto, marcarEscrito],
  );

  /** Otra pestaña ha guardado, o se vuelve a esta: se trae lo nuevo o se avisa del conflicto. */
  const sincronizar = useCallback(
    () =>
      encolar(async () => {
        if (!cargado.current || enConflicto.current) return;
        const enAlmacen = await cargarMazo();
        const actual = ultimo.current;
        const cambiosSinGuardar = !!actual && actual !== escrito.current && !sinNadaQuePerder(actual);
        const decision = decidirSincronizacion({ guardado: versionDe(enAlmacen), base: base.current, cambiosSinGuardar });
        if (decision === "recargar" && enAlmacen) {
          pararTemporizador();
          tomarGuardado(enAlmacen);
        } else if (decision === "conflicto") avisarConflicto(versionDe(enAlmacen));
      }),
    [encolar, tomarGuardado, avisarConflicto],
  );

  useEffect(() => {
    let vivo = true;
    pestana.current = idPestana();
    canal.current = abrirCanal(pestana.current, (m) => {
      if (m.tipo === "hola") canal.current?.enviar({ tipo: "aqui", pestana: pestana.current });
      else if (m.tipo === "aqui") hayOtras.current = true;
      else void sincronizar();
    });
    canal.current?.enviar({ tipo: "hola", pestana: pestana.current });
    let limpieza: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const ok = await almacenDisponible();
      const mazo = ok ? await cargarMazo() : null;
      // Las fotos que ya había al abrir: entre ellas se buscan las sueltas (abajo).
      const fotosAlAbrir = ok ? await idsDeFotos() : new Set<string>();
      if (!vivo) return;
      setAlmacenOk(ok);
      sinAlmacen.current = !ok;
      setAlAbrir(mazo);
      base.current = versionDe(mazo);
      marcarEscrito(mazo);
      ultimo.current = mazo;
      setGuardado(!ok ? { tipo: "sin-almacen" } : mazo ? { tipo: "guardado", en: mazo.actualizadoEn } : { tipo: "guardando" });
      despacharAlReductor({ tipo: "cargar", mazo });
      cargado.current = true;
      // Fotos que quedaron sueltas (una importación cortada, cartas borradas, o fotos sin mazo si se
      // cortó antes de guardarlo por primera vez): fuera, salvo que otra pestaña tenga el mazo
      // abierto, porque podría estar subiendo fotos que aún no son cartas. Solo las que ya estaban
      // al abrir: las que esta pestaña guarde mientras tanto se quedan.
      if (fotosAlAbrir.size)
        limpieza = setTimeout(() => {
          if (vivo && !hayOtras.current) void borrarFotos(fotosSueltas(fotosAlAbrir, mazo, ultimo.current));
        }, ESPERA_OTRAS_PESTANAS_MS);
    })();

    return () => {
      vivo = false;
      clearTimeout(limpieza);
      canal.current?.cerrar();
      canal.current = null;
    };
  }, [sincronizar, marcarEscrito]);

  // Guardado automático al poco de cada cambio, sin bloquear la interfaz.
  useEffect(() => {
    ultimo.current = estado.mazo;
    if (!cargado.current || estado.estado !== "listo" || estado.mazo === escrito.current) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    const ahora = Date.now();
    pendienteDesde.current ??= ahora;
    // Las cartas de fotos recién importadas no esperan: si el navegador se cierra de golpe a mitad
    // de la importación, las fotos leídas ya tienen su carta en el mazo guardado.
    const espera = sinEsperar.current ? 0 : Math.max(0, Math.min(ESPERA_GUARDADO_MS, pendienteDesde.current + ESPERA_MAXIMA_MS - ahora));
    sinEsperar.current = false;
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      pendienteDesde.current = null;
      void escribir();
    }, espera);
  }, [estado.mazo, estado.estado, escribir]);

  // Al ocultar la página (cambiar de app en el móvil, cerrar la pestaña) se guarda ya; al volver a
  // ella, se mira si otra pestaña ha cambiado el mazo mientras tanto.
  useEffect(() => {
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "hidden") {
        pararTemporizador();
        void escribir();
      } else void sincronizar();
    };
    const alSalir = () => {
      pararTemporizador();
      void escribir();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("pagehide", alSalir);
    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("pagehide", alSalir);
    };
  }, [escribir, sincronizar]);

  // Al salir sin recargar (navegación interna), se guarda lo último sin esperar.
  useEffect(
    () => () => {
      pararTemporizador();
      void escribir();
    },
    [escribir],
  );

  // Tras el permiso de las fotos o la primera foto, que el navegador no borre el almacén si le falta espacio.
  const pedirPersistencia = !!estado.mazo && debePedirPersistencia(estado.mazo);
  useEffect(() => {
    if (pedirPersistencia) void pedirAlmacenPersistente();
  }, [pedirPersistencia]);

  const reiniciarTodo = useCallback(async () => {
    pararTemporizador();
    await encolar(async () => {
      await borrarTodo();
      base.current = null;
      marcarEscrito(null);
      enConflicto.current = false;
      setGuardado({ tipo: "guardando" });
      despacharAlReductor({ tipo: "reiniciar" });
    });
  }, [encolar, marcarEscrito]);

  const guardarAhora = useCallback(
    async (mazo?: Mazo | null) => {
      pararTemporizador();
      if (mazo) ultimo.current = mazo;
      await escribir();
    },
    [escribir],
  );

  const recargar = useCallback(async () => {
    pararTemporizador();
    await encolar(async () => {
      const enAlmacen = await cargarMazo();
      if (enAlmacen) return tomarGuardado(enAlmacen);
      // Se borró en la otra pestaña y no hay otro: lo de esta pasa a ser lo guardado.
      base.current = null;
      marcarEscrito(null);
      enConflicto.current = false;
      setGuardado({ tipo: "guardando" });
    });
    await escribir();
  }, [encolar, tomarGuardado, escribir, marcarEscrito]);

  // Con cambios que aún esperan al guardado automático, la línea no dice «Guardado»: si se cierra
  // la pestaña justo entonces, lo último podría no llegar al dispositivo.
  const sinGuardar = estado.estado === "listo" && estado.mazo !== enDispositivo;
  const guardadoVisible = useMemo<EstadoGuardado>(() => (guardado.tipo === "guardado" && sinGuardar ? { tipo: "guardando" } : guardado), [guardado, sinGuardar]);

  const valor = useMemo<ValorContexto>(
    () => ({ ...estado, despachar, puedeDeshacer: estado.pasado.length > 0, almacenOk, guardado: guardadoVisible, alAbrir, reiniciarTodo, guardarAhora, recargar }),
    [estado, despachar, almacenOk, guardadoVisible, alAbrir, reiniciarTodo, guardarAhora, recargar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useMazo(): ValorContexto {
  const v = useContext(Contexto);
  if (!v) throw new Error("useMazo fuera de ProveedorMazo");
  return v;
}
