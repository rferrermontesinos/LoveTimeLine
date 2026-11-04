import { colorGlifo, obtenerEstilo, obtenerPaleta, obtenerPlantilla, rutaIcono } from "@/lib/estilos";

/**
 * Icono de la esquina de las cartas («estrella», «comodin», «en-blanco»…), igual que en el hueco
 * de la pestaña: la misma ruta de la plantilla, sobre un círculo de tinta y con el color de la
 * paleta. Sin paleta, la del estilo por defecto. Si la plantilla no tiene ese icono, no pinta nada.
 */
export function IconoMecanica({
  icono,
  tamano = "md",
  estiloId,
  paletaId,
  className,
}: {
  icono: string | null | undefined;
  tamano?: "sm" | "md";
  estiloId?: string;
  paletaId?: string;
  /** Tamaño a medida (por ejemplo en mm, para el folleto); sustituye al de `tamano`. */
  className?: string;
}) {
  const estilo = obtenerEstilo(estiloId);
  const plantilla = obtenerPlantilla(estilo.plantilla);
  const ruta = rutaIcono(plantilla, icono);
  if (!ruta) return null;
  const color = colorGlifo(obtenerPaleta(estilo, paletaId), estilo.colores);
  // En la carta, el lado del icono es `glifo` radios del círculo: aquí, en % del diámetro.
  const lado = `${(plantilla.pestana.hueco.glifo / 2) * 100}%`;
  return (
    <span
      aria-hidden="true"
      className={`${className ?? (tamano === "sm" ? "h-9 w-9" : "h-12 w-12")} grid shrink-0 place-items-center rounded-full`}
      style={{ background: estilo.colores.tinta }}
    >
      <svg viewBox="0 0 24 24" style={{ width: lado, height: lado }}>
        <path d={ruta.d} fillRule={ruta.regla} fill={color} />
      </svg>
    </span>
  );
}
