import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type Variante = "primario" | "secundario" | "acento" | "fantasma" | "peligro";
type Tamano = "md" | "sm" | "lg";

const BASE =
  "tipo-boton inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] transition-[background-color,transform,box-shadow] duration-150 ease-[var(--ease-salida)] select-none disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-tinta text-papel hover:bg-tinta-hover",
  secundario: "border-2 border-tinta bg-transparent text-tinta hover:bg-papel-2",
  acento: "text-tinta hover:brightness-95 shadow-[inset_0_0_0_2px_var(--color-tinta)]",
  fantasma: "bg-transparent text-tinta hover:bg-papel-2",
  peligro: "border-2 border-rojo-texto bg-transparent text-rojo-texto hover:bg-papel-2",
};
const TAMANOS: Record<Tamano, string> = {
  sm: "min-h-10 px-3.5 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-7 text-md",
};

export function clasesBoton(variante: Variante = "primario", tamano: Tamano = "md", extra = "") {
  return `${BASE} ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`;
}

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  /** Color de fondo para la variante «acento» (una tinta riso). */
  color?: string;
  icono?: ReactNode;
}

export const Boton = forwardRef<HTMLButtonElement, PropsBoton>(function Boton(
  { variante = "primario", tamano = "md", color, icono, className = "", style, children, type = "button", ...resto },
  ref,
) {
  const estilo: CSSProperties | undefined = variante === "acento" ? { background: color ?? "var(--color-rosa)", ...style } : style;
  return (
    <button ref={ref} type={type} className={clasesBoton(variante, tamano, className)} style={estilo} {...resto}>
      {icono}
      {children}
    </button>
  );
});

interface PropsEnlace {
  href: string;
  variante?: Variante;
  tamano?: Tamano;
  color?: string;
  className?: string;
  children: ReactNode;
}

export function BotonEnlace({ href, variante = "primario", tamano = "md", color, className = "", children }: PropsEnlace) {
  return (
    <Link href={href} className={clasesBoton(variante, tamano, className)} style={variante === "acento" ? { background: color } : undefined}>
      {children}
    </Link>
  );
}
