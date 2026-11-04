"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Aviso } from "@/components/ui/Piezas";
import { cargarFuentesCartas, fuentesCartasCargadas } from "@/lib/carta/fuentes";
import { ESTILOS, obtenerPlantilla } from "@/lib/estilos";
import { pedirQueGuarden } from "./registroSw";

/**
 * El service worker (public/sw.js), con la versión de esta compilación: tras desplegar, la URL
 * cambia y el navegador instala el nuevo, que borra las copias del anterior al activarse.
 */
const URL_SERVICE_WORKER = `/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_VERSION_SW || "local")}`;

function suscribirConexion(aviso: () => void): () => void {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

/** El navegador dice que no hay conexión. En el servidor (y al hidratar) se supone que sí. */
export function useSinConexion(): boolean {
  return useSyncExternalStore(
    suscribirConexion,
    () => !navigator.onLine,
    () => false,
  );
}

/** Aviso arriba del configurador mientras no hay conexión: se puede seguir, todo queda en el dispositivo. */
export function AvisoSinConexion() {
  const t = useTranslations("crear.sinConexion");
  const sinConexion = useSinConexion();
  if (!sinConexion) return null;
  return (
    <Aviso tono="aviso">
      <span data-testid="aviso-sin-conexion">{t("aviso")}</span>
    </Aviso>
  );
}

/** El navegador pide ahorrar datos: no se adelanta lo que pesa mucho y quizá no se use. */
function ahorroDeDatos(): boolean {
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!conexion?.saveData;
}

let precarga: Promise<boolean> | null = null;

/**
 * Carga por adelantado lo que el configurador solo carga al usarlo (la lectura de fechas, la
 * conversión de HEIC, el editor de emojis y las fuentes de las cartas), para tenerlo si se va la
 * conexión. Una vez por página; si algo falla, se reintenta la siguiente vez que se pida.
 */
export function precargarBajoDemanda(): Promise<boolean> {
  if (!precarga) {
    const plantillas = [...new Set(ESTILOS.map((e) => e.plantilla))].map(obtenerPlantilla);
    precarga = Promise.allSettled([
      import("exifr"),
      // Solo hace falta con fotos HEIC (iPhone) y es lo que más pesa.
      ahorroDeDatos() ? Promise.resolve() : import("heic2any"),
      import("./EditorAdornos"),
      ...plantillas.map(async (p) => {
        await cargarFuentesCartas(p);
        if (!fuentesCartasCargadas(p)) throw new Error("Faltan fuentes de las cartas");
      }),
    ]).then((resultados) => {
      const ok = resultados.every((r) => r.status === "fulfilled");
      if (!ok) precarga = null;
      return ok;
    });
  }
  return precarga;
}

/**
 * Lo que la página ya ha cargado de este mismo sitio. El service worker se queda solo con el
 * código y las fuentes (ver public/sw.js); las fotos nunca pasan por la red.
 */
function recursosCargados(): string[] {
  if (typeof performance === "undefined" || !performance.getEntriesByType) return [];
  return performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => u.startsWith(`${window.location.origin}/`));
}

/**
 * Registra el service worker (solo en producción: en desarrollo el código cambia a cada momento)
 * y le pide que guarde lo que esta página ya ha cargado: al activo y, tras un despliegue, también
 * al nuevo que espera para sustituirlo. Sin service worker todo funciona igual con conexión; solo
 * no se puede reabrir la página sin ella.
 */
async function registrarServiceWorker(): Promise<void> {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register(URL_SERVICE_WORKER, { scope: "/", updateViaCache: "none" });
    pedirQueGuarden(await navigator.serviceWorker.ready, recursosCargados);
  } catch (e) {
    console.warn("No se pudo registrar el service worker", e);
  }
}

/** Cuando el navegador esté libre (o, si no lo dice, al rato). Devuelve cómo cancelarlo. */
function enReposo(tarea: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(tarea, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(tarea, 1500);
  return () => window.clearTimeout(id);
}

/**
 * Deja la página lista para seguir sin conexión: con conexión y en un rato libre, adelanta lo que
 * se carga bajo demanda (si `precargar`) y registra el service worker. Si vuelve la conexión
 * después de un fallo, lo reintenta.
 */
export function usePrepararSinConexion({ precargar = true }: { precargar?: boolean } = {}): void {
  useEffect(() => {
    let vigente = true;
    const preparar = async () => {
      if (!vigente || !navigator.onLine) return;
      if (precargar) await precargarBajoDemanda();
      if (vigente) await registrarServiceWorker();
    };
    const cancelar = enReposo(() => void preparar());
    const alVolverLaConexion = () => void preparar();
    window.addEventListener("online", alVolverLaConexion);
    return () => {
      vigente = false;
      cancelar();
      window.removeEventListener("online", alVolverLaConexion);
    };
  }, [precargar]);
}
