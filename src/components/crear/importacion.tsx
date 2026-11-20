"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Aviso, CerrarAviso, Franja } from "@/components/ui/Piezas";
import { crearDetectorSesion } from "@/domain/fechas/sesion";
import { esErrorDeEspacio, guardarFoto } from "@/lib/almacen/idb";
import { archivosDeArrastre, concurrenciaRecomendada, enCola, esImagenCompatible, procesarArchivo } from "@/lib/importar/procesar";
import { useMazo } from "@/lib/mazo/contexto";
import { cartaDesdeFoto, proporcionReversoDe } from "@/lib/mazo/derivados";
import { esFoto, type CartaFoto } from "@/lib/mazo/tipos";

/** Cómo ha ido la última subida. */
export interface ResumenImportacion {
  anadidas: number;
  /** De las añadidas, las que se han quedado sin fecha. */
  sinFecha: number;
  /** De las sin fecha, las que llegaron hace poco por WhatsApp u otra app de mensajes y perdieron su fecha. */
  porMensajeria: number;
  /** De las sin fecha, las que tienen una fecha sugerida: se completan con un toque en Cartas. */
  conSugerencia: number;
  repetidas: number;
  errores: number;
  /** Fotos que no se han podido guardar porque no queda espacio en el dispositivo. */
  sinEspacio: number;
}

interface ValorImportacion {
  progreso: { hechas: number; total: number } | null;
  resumen: ResumenImportacion | null;
  cerrarResumen: () => void;
  /**
   * Lee las fotos en el navegador y las añade al mazo, una a una según se guardan. Sin el permiso
   * de las fotos no se lee nada: se quedan esperando hasta que se dé (`enEspera`).
   */
  importar: (archivos: File[]) => void;
  /** Da el permiso de las fotos y añade las que esperaban. */
  consentir: () => void;
  /** Fotos elegidas o soltadas antes de dar el permiso. */
  enEspera: number;
  /** Sube cada vez que se intenta añadir fotos sin el permiso. */
  intentosSinPermiso: number;
  /**
   * True una sola vez por cada intento sin permiso: quien lo atiende (el paso de fotos) resalta la
   * casilla. Así, al volver a Fotos más tarde, no se resalta otra vez un intento ya atendido.
   */
  tomarIntento: () => boolean;
  /** Para los botones «Elegir fotos»: sin permiso, cuenta el intento y devuelve false. */
  puedeElegir: () => boolean;
}

const Ctx = createContext<ValorImportacion | null>(null);

/**
 * La subida de fotos, compartida por Fotos y Cartas: sigue aunque se cambie de paso, y el
 * resumen se ve al volver. Las subidas seguidas se encadenan, una detrás de otra.
 */
export function ProveedorImportacion({ children }: { children: ReactNode }) {
  const { mazo, despachar } = useMazo();
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const esperando = useRef<File[]>([]);
  const [enEspera, setEnEspera] = useState(0);
  const [intentosSinPermiso, setIntentos] = useState(0);
  const atendidos = useRef(0);
  const cola = useRef<Promise<void>>(Promise.resolve());
  // El mazo de cada momento, para leerlo al empezar cada subida de la cola (no el de cuando se pidió).
  const mazoActual = useRef(mazo);
  useEffect(() => {
    mazoActual.current = mazo;
  }, [mazo]);

  const subir = useCallback(
    async (archivos: File[]) => {
      const m = mazoActual.current;
      if (!m || archivos.length === 0) return;
      const imagenes = archivos.filter(esImagenCompatible);
      const vistos = new Set(m.cartas.filter(esFoto).map((c) => c.hash));
      const hoy = new Date();
      const sesion = crearDetectorSesion(hoy);
      const propReverso = proporcionReversoDe(m);
      // Cómo queda cada carta añadida (una sesión puede dejar en blanco las de antes).
      const finales = new Map<string, CartaFoto>();
      const r = { repetidas: 0, errores: archivos.length - imagenes.length, sinEspacio: 0 };
      setResumen(null);
      setProgreso({ hechas: 0, total: imagenes.length });
      let hechas = 0;
      await enCola(
        // Por nombre: las fotos de la cámara salen en el orden en que se hicieron.
        imagenes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
        concurrenciaRecomendada(),
        async (archivo) => {
          const foto = await procesarArchivo(archivo, hoy);
          if (vistos.has(foto.hash)) return null;
          vistos.add(foto.hash);
          await guardarFoto(foto.id, foto.copia, foto.mini);
          return foto;
        },
        (res) => {
          hechas++;
          if (res.ok && res.valor) {
            const foto = res.valor;
            let carta = cartaDesdeFoto(foto, propReverso, Date.now());
            const { enBlanco, anteriores } = sesion.registrar(carta.id, foto.propuesta);
            if (anteriores.length) {
              despachar({ tipo: "fechaASugerencia", ids: anteriores, motivo: "sesion-de-escaneo" });
              for (const id of anteriores) {
                const c = finales.get(id);
                if (c) finales.set(id, { ...c, fecha: null, motivo: "sesion-de-escaneo" });
              }
            }
            if (enBlanco && carta.fecha && carta.fuente && carta.fuente !== "manual") {
              const sugerencia = { fecha: carta.fecha, fuente: carta.fuente, motivo: "sesion-de-escaneo" as const };
              carta = { ...carta, fecha: null, fuente: null, confianza: null, motivo: "sesion-de-escaneo", sugerencias: [sugerencia] };
            }
            finales.set(carta.id, carta);
            // Cada carta entra en el mazo en cuanto su foto está guardada: si la subida se corta
            // (se cierra la pestaña, se va la batería), lo subido hasta ahí ya está en el mazo.
            despachar({ tipo: "anadirCartas", cartas: [carta] });
          } else if (res.ok) r.repetidas++;
          else if (esErrorDeEspacio(res.error)) r.sinEspacio++;
          else {
            r.errores++;
            console.warn("No se pudo leer", res.entrada.name, res.error);
          }
          setProgreso({ hechas, total: imagenes.length });
        },
      );
      const cartas = [...finales.values()];
      const sinFecha = cartas.filter((c) => !c.fecha);
      setProgreso(null);
      setResumen({
        anadidas: cartas.length,
        sinFecha: sinFecha.length,
        porMensajeria: sinFecha.filter((c) => c.motivo === "fecha-de-envio").length,
        conSugerencia: sinFecha.filter((c) => (c.sugerencias?.length ?? 0) > 0).length,
        ...r,
      });
    },
    [despachar],
  );

  const encolar = useCallback(
    (archivos: File[]) => {
      if (archivos.length === 0) return;
      const siguiente = cola.current.then(() => subir(archivos));
      cola.current = siguiente.catch((e) => console.warn("Subida interrumpida", e));
    },
    [subir],
  );

  const importar = useCallback(
    (archivos: File[]) => {
      if (archivos.length === 0) return;
      if (!mazoActual.current?.consentimientoFotos) {
        esperando.current = [...esperando.current, ...archivos];
        setEnEspera(esperando.current.length);
        setIntentos((n) => n + 1);
        return;
      }
      encolar(archivos);
    },
    [encolar],
  );

  const consentir = useCallback(() => {
    despachar({ tipo: "consentir", ahora: Date.now() });
    const lista = esperando.current;
    esperando.current = [];
    setEnEspera(0);
    encolar(lista);
  }, [despachar, encolar]);

  const cerrarResumen = useCallback(() => setResumen(null), []);

  const valor = useMemo<ValorImportacion>(
    () => ({
      progreso,
      resumen,
      cerrarResumen,
      importar,
      consentir,
      enEspera,
      intentosSinPermiso,
      tomarIntento: () => {
        if (intentosSinPermiso <= atendidos.current) return false;
        atendidos.current = intentosSinPermiso;
        return true;
      },
      puedeElegir: () => {
        if (mazoActual.current?.consentimientoFotos) return true;
        setIntentos((n) => n + 1);
        return false;
      },
    }),
    [progreso, resumen, cerrarResumen, importar, consentir, enEspera, intentosSinPermiso],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useImportacion(): ValorImportacion {
  const v = useContext(Ctx);
  if (!v) throw new Error("useImportacion fuera de ProveedorImportacion");
  return v;
}

const ACEPTA = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

/**
 * Las dos entradas de archivo ocultas (fotos sueltas y carpeta entera) y lo que las abre. Sin el
 * permiso de las fotos no se abren: se cuenta el intento y el paso de fotos resalta la casilla.
 */
export function useElegirFotos() {
  const { importar, puedeElegir } = useImportacion();
  const fotos = useRef<HTMLInputElement>(null);
  const carpeta = useRef<HTMLInputElement>(null);
  const alElegir = (e: ChangeEvent<HTMLInputElement>) => {
    importar([...(e.target.files ?? [])]);
    e.target.value = "";
  };
  const entradas = (
    <>
      <input
        ref={fotos}
        type="file"
        multiple
        accept={ACEPTA}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="entrada-fotos"
        onChange={alElegir}
      />
      <input
        ref={carpeta}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={alElegir}
      />
    </>
  );
  return {
    entradas,
    elegirFotos: () => {
      if (puedeElegir()) fotos.current?.click();
    },
    elegirCarpeta: () => {
      if (puedeElegir()) carpeta.current?.click();
    },
  };
}

/** Lleva archivos (no texto ni enlaces arrastrados desde la propia página). */
function conArchivos(e: DragEvent): boolean {
  return !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
}

/**
 * Soltar fotos o carpetas en cualquier punto de la página, mientras `activo`. Al arrastrar
 * archivos encima se ve un aviso a pantalla completa. Además evita que el navegador abra la foto
 * soltada fuera de una zona (y se pierda el mazo de la pestaña).
 */
export function SoltarFotos({ activo }: { activo: boolean }) {
  const t = useTranslations("fotos");
  const { importar } = useImportacion();
  const [encima, setEncima] = useState(false);

  useEffect(() => {
    if (!activo) return;
    let temporizador: number | undefined;
    // `dragover` llega sin parar mientras hay algo encima de la página; cuando deja de llegar, se ha
    // ido (más fiable que contar dragenter y dragleave, que cada navegador cuenta a su manera).
    const sobre = (e: DragEvent) => {
      if (!conArchivos(e) || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setEncima(true);
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => setEncima(false), 700);
    };
    const soltar = (e: DragEvent) => {
      if (!conArchivos(e) || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      window.clearTimeout(temporizador);
      setEncima(false);
      if (e.dataTransfer) void archivosDeArrastre(e.dataTransfer).then(importar);
    };
    window.addEventListener("dragover", sobre);
    window.addEventListener("drop", soltar);
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener("dragover", sobre);
      window.removeEventListener("drop", soltar);
      setEncima(false);
    };
  }, [activo, importar]);

  if (!encima) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-papel/80 p-6 backdrop-blur-[2px]">
      <div className="rounded-[var(--radius-carta)] border-[3px] border-dashed border-cobalto bg-[#E8EDFD] px-10 py-12 text-center shadow-[var(--shadow-flotante)]">
        <p className="tipo-subtitular text-xl">{t("soltarActivo")}</p>
      </div>
    </div>
  );
}

/**
 * La subida en curso (barra de progreso) y, al acabar, cómo ha ido: cuántas se han añadido,
 * cuántas se han quedado sin fecha y, si alguna llegó por WhatsApp hace poco, por qué.
 */
export function EstadoImportacion() {
  const t = useTranslations("fotos");
  const tc = useTranslations("crear");
  const { progreso, resumen, cerrarResumen } = useImportacion();
  if (progreso) {
    return (
      <div className="space-y-2" aria-live="polite">
        <Franja valor={progreso.total ? progreso.hechas / progreso.total : 0} etiqueta={t("procesando", progreso)} />
        <p className="text-sm font-semibold">{t("procesando", progreso)}</p>
      </div>
    );
  }
  if (!resumen) return null;
  return (
    <Aviso
      tono={resumen.sinEspacio ? "error" : resumen.errores ? "aviso" : "exito"}
      accion={<CerrarAviso etiqueta={tc("cerrarAviso")} alCerrar={cerrarResumen} />}
    >
      <p data-testid="resumen-subida">
        <span className="font-semibold">{t("procesadas", { n: resumen.anadidas })}</span>
        {resumen.anadidas > 0 && <> · {resumen.sinFecha ? t("resumenSinFecha", { n: resumen.sinFecha }) : t("resumenConFecha", { n: resumen.anadidas })}</>}
        {resumen.repetidas > 0 && <> · {t("repetidas", { n: resumen.repetidas })}</>}
        {resumen.errores > 0 && <> · {t("errores", { n: resumen.errores })}</>}
        {resumen.sinEspacio > 0 && <> · {t("sinEspacio", { n: resumen.sinEspacio })}</>}
      </p>
      {resumen.conSugerencia > 0 && <p className="mt-1">{t("conSugerencia", { n: resumen.conSugerencia })}</p>}
      {resumen.porMensajeria > 0 && <p className="mt-1">{t("porMensajeria", { n: resumen.porMensajeria })}</p>}
    </Aviso>
  );
}
