import type { CSSProperties, ReactNode } from "react";

/** Pestaña de esquina, el gesto gráfico de las cartas Naipe. */
export function Pestana({ children, color = "var(--color-rosa)", tamano = "md", className = "" }: { children: ReactNode; color?: string; tamano?: "sm" | "md" | "lg"; className?: string }) {
  const medidas = {
    sm: "h-[44px] w-[32px] pl-2 pt-1.5 text-[20px] rounded-[0_0_10px_0]",
    md: "h-[60px] w-[42px] pl-2.5 pt-2 text-[28px] rounded-[0_0_14px_0]",
    lg: "h-[84px] w-[58px] pl-3 pt-2.5 text-[42px] rounded-[0_0_18px_0]",
  }[tamano];
  return (
    <span aria-hidden="true" className={`tipo-titular absolute left-0 top-0 flex items-start leading-[0.85] text-tinta ${medidas} ${className}`} style={{ background: color }}>
      {children}
    </span>
  );
}

/** Franja de 12 casillas: la regla de meses de las cartas, usada como barra de progreso. */
export function Franja({ valor, total = 12, color = "var(--color-rojo)", etiqueta, className = "" }: { valor: number; total?: number; color?: string; etiqueta?: string; className?: string }) {
  const llenas = Math.round(Math.min(1, Math.max(0, valor)) * total);
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor * 100)}
      className={`flex h-4 items-center gap-[3px] rounded-[4px] px-1.5 ${className}`}
      style={{ background: color }}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-2 flex-1 rounded-[2px] transition-colors duration-200" style={{ background: i < llenas ? "var(--color-tinta)" : "rgba(245,240,230,.7)" }} />
      ))}
    </div>
  );
}

export function Micro({ children, className = "", as: Etiqueta = "p" }: { children: ReactNode; className?: string; as?: "p" | "span" | "h2" | "h3" | "div" }) {
  return <Etiqueta className={`tipo-micro text-micro ${className}`}>{children}</Etiqueta>;
}

export function Interruptor({
  activo,
  alCambiar,
  etiqueta,
  descripcion,
  id,
  deshabilitado,
  alFinal = false,
}: {
  activo: boolean;
  alCambiar: (v: boolean) => void;
  etiqueta: ReactNode;
  descripcion?: ReactNode;
  id: string;
  deshabilitado?: boolean;
  /** Pone el interruptor a la derecha del texto, como en los ajustes del móvil. */
  alFinal?: boolean;
}) {
  const boton = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={activo}
      aria-describedby={descripcion ? `${id}-desc` : undefined}
      disabled={deshabilitado}
      onClick={() => alCambiar(!activo)}
      className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-tinta transition-colors disabled:opacity-45 ${activo ? "bg-tinta" : "bg-blanco"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full transition-transform duration-150 ${activo ? "translate-x-[22px] bg-papel" : "translate-x-[2px] bg-tinta"}`} />
    </button>
  );
  const texto = (
    <label htmlFor={id} className={`cursor-pointer ${alFinal ? "min-w-0 flex-1" : ""}`}>
      <span className="block font-semibold leading-snug">{etiqueta}</span>
      {descripcion && (
        <span id={`${id}-desc`} className="mt-0.5 block text-sm text-tinta-2">
          {descripcion}
        </span>
      )}
    </label>
  );
  return (
    <div className={`flex items-start gap-3 ${alFinal ? "justify-between" : ""}`}>
      {alFinal ? (
        <>
          {texto}
          {boton}
        </>
      ) : (
        <>
          {boton}
          {texto}
        </>
      )}
    </div>
  );
}

export function Aviso({ tono = "info", children, className = "", accion }: { tono?: "info" | "aviso" | "error" | "exito"; children: ReactNode; className?: string; accion?: ReactNode }) {
  const estilos: Record<string, CSSProperties> = {
    info: { background: "var(--color-blanco)", boxShadow: "inset 4px 0 0 var(--color-cobalto)" },
    aviso: { background: "#FFF4D6", boxShadow: "inset 4px 0 0 var(--color-amarillo)" },
    error: { background: "#FBE7E4", boxShadow: "inset 4px 0 0 var(--color-rojo-texto)" },
    exito: { background: "#E3F4EA", boxShadow: "inset 4px 0 0 var(--color-verde-texto)" },
  };
  return (
    <div role={tono === "error" ? "alert" : "status"} className={`flex flex-wrap items-center justify-between gap-3 rounded-[12px] px-4 py-3 text-sm ${className}`} style={estilos[tono]}>
      <div className="min-w-0 flex-1">{children}</div>
      {accion}
    </div>
  );
}

export function Chip({ children, color, className = "", titulo }: { children: ReactNode; color?: string; className?: string; titulo?: string }) {
  return (
    <span title={titulo} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold leading-5 ${className}`} style={{ background: color ?? "var(--color-papel-2)" }}>
      {children}
    </span>
  );
}

export function Seccion({ id, children, className = "", etiqueta }: { id?: string; children: ReactNode; className?: string; etiqueta?: string }) {
  return (
    <section id={id} aria-label={etiqueta} className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}
