"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Diálogo modal nativo: foco atrapado y Escape para cerrar sin código extra. */
export function Dialogo({
  abierto,
  alCerrar,
  titulo,
  children,
  pie,
  ancho = "max-w-lg",
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      onCancel={(e) => {
        e.preventDefault();
        alCerrar();
      }}
      aria-labelledby="dialogo-titulo"
      className={`m-auto w-[calc(100%-2rem)] ${ancho} rounded-[var(--radius-carta)] bg-papel p-0 text-tinta shadow-[var(--shadow-carta)] backdrop:bg-tinta/55`}
    >
      {abierto && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-linea px-5 py-4">
            <h2 id="dialogo-titulo" className="tipo-titular text-xl">
              {titulo}
            </h2>
            <button type="button" onClick={alCerrar} className="grid h-10 w-10 place-items-center rounded-full text-xl hover:bg-papel-2" aria-label="Cerrar">
              ×
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {pie && <footer className="flex flex-wrap justify-end gap-2 border-t border-linea px-5 py-4">{pie}</footer>}
        </div>
      )}
    </dialog>
  );
}
