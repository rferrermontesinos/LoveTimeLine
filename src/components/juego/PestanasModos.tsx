"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { leerAncla } from "./ancla";

export interface PanelModo {
  /** Id del tipo de juego; también es el ancla de la página (#clasico, #historia). */
  id: string;
  nombre: string;
  /** Color de su pestaña de esquina. */
  color: string;
  contenido: ReactNode;
}

function suscribirHash(avisar: () => void) {
  window.addEventListener("hashchange", avisar);
  return () => window.removeEventListener("hashchange", avisar);
}
// Nunca lanza: un ancla mal escapada (#%) no puede tirar la página al leerse.
const hashActual = () => leerAncla(window.location.hash);
const sinHash = () => "";

/**
 * Pestañas de los tipos de juego, con el patrón de pestañas accesibles: flechas, Inicio y Fin
 * cambian de pestaña; cada panel lleva el nombre de la suya. El ancla de la URL (#historia) abre
 * su pestaña y baja hasta ella, y al cambiar de pestaña se actualiza sin saltar.
 */
export function PestanasModos({ paneles, etiqueta, idSeccion }: { paneles: PanelModo[]; etiqueta: string; idSeccion: string }) {
  const base = useId();
  const hash = useSyncExternalStore(suscribirHash, hashActual, sinHash);
  // Lo elegido a mano manda hasta que cambie el ancla (un enlace a #clasico o #historia).
  const [elegido, setElegido] = useState<{ id: string; conHash: string } | null>(null);
  const porHash = paneles.some((p) => p.id === hash) ? hash : null;
  const activo = elegido && elegido.conHash === hash ? elegido.id : (porHash ?? paneles[0]!.id);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  // Ancla puesta por las propias pestañas: no hace bajar la página.
  const propia = useRef<string | null>(null);

  // Al llegar con el ancla de un tipo de juego (desde la portada) o seguir un enlace a ella, se
  // baja hasta las pestañas: el panel oculto no deja que el navegador lo haga solo.
  useEffect(() => {
    if (porHash && porHash !== propia.current) document.getElementById(idSeccion)?.scrollIntoView({ block: "start" });
  }, [porHash, idSeccion]);

  const elegir = (id: string, foco = false) => {
    propia.current = id;
    setElegido({ id, conHash: id });
    window.history.replaceState(null, "", `#${id}`);
    if (foco) botones.current[paneles.findIndex((p) => p.id === id)]?.focus();
  };

  const teclas = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = paneles.length;
    const destino = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    elegir(paneles[destino]!.id, true);
  };

  return (
    <div>
      <div role="tablist" aria-label={etiqueta} className="flex flex-wrap gap-2">
        {paneles.map((p, i) => {
          const sel = p.id === activo;
          return (
            <button
              key={p.id}
              ref={(el) => {
                botones.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-pestana-${p.id}`}
              aria-selected={sel}
              aria-controls={p.id}
              tabIndex={sel ? 0 : -1}
              onClick={() => elegir(p.id)}
              onKeyDown={(e) => teclas(e, i)}
              className={`tipo-boton relative inline-flex min-h-12 items-center gap-3 overflow-hidden rounded-[var(--radius-control)] py-2 pl-12 pr-5 text-md transition-colors duration-150 ${
                sel ? "bg-papel text-tinta" : "bg-transparent text-papel shadow-[inset_0_0_0_2px_rgba(245,240,230,0.35)] hover:bg-papel/10"
              }`}
            >
              <span aria-hidden="true" className="tipo-titular absolute left-0 top-0 flex h-full w-8 items-start justify-center pt-1.5 text-[1.15rem] leading-none text-tinta" style={{ background: p.color }}>
                {i + 1}
              </span>
              {p.nombre}
            </button>
          );
        })}
      </div>
      {paneles.map((p) => (
        <section
          key={p.id}
          id={p.id}
          role="tabpanel"
          aria-labelledby={`${base}-pestana-${p.id}`}
          tabIndex={0}
          hidden={p.id !== activo}
          className="mt-6 scroll-mt-28 rounded-[var(--radius-carta)]"
        >
          {p.contenido}
        </section>
      ))}
    </div>
  );
}
