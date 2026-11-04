/** Icono redondo de cada mecánica de juego, igual que en el hueco de la pestaña. */
export function IconoMecanica({ id, tamano = "md" }: { id: string; tamano?: "sm" | "md" }) {
  const comun = `${tamano === "sm" ? "h-9 w-9" : "h-12 w-12"} shrink-0 rounded-full grid place-items-center`;
  const svg = tamano === "sm" ? "h-5 w-5" : "h-7 w-7";
  if (id === "estrella")
    return (
      <span aria-hidden="true" className={`${comun} bg-tinta`}>
        <svg viewBox="0 0 24 24" className={`${svg} fill-rosa`}>
          <path d="M12 2.2l2.92 6.26 6.86.78-5.1 4.66 1.4 6.76L12 17.25 5.92 20.66l1.4-6.76-5.1-4.66 6.86-.78L12 2.2z" />
        </svg>
      </span>
    );
  if (id === "cuentalo")
    return (
      <span aria-hidden="true" className={`${comun} bg-tinta`}>
        <svg viewBox="0 0 24 24" className={`${svg} fill-amarillo`}>
          <path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 20 17H10.2l-4.7 3.6V17H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5z" />
        </svg>
      </span>
    );
  if (id === "comodin")
    return (
      <span aria-hidden="true" className={`${comun} tipo-titular bg-rojo text-xl`}>
        ★
      </span>
    );
  return (
    <span aria-hidden="true" className={`${comun} border-2 border-dashed border-tinta bg-papel`}>
      <span className="tipo-titular text-lg">+</span>
    </span>
  );
}
