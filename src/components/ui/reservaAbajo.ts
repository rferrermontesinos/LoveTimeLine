/**
 * Ref para una barra o aviso fijo abajo de la pantalla. Mientras está montado, guarda su alto
 * (más su separación del borde) en `--reserva-abajo`, que `html` usa como scroll-padding-bottom:
 * así, cuando el navegador desplaza la página para enseñar el control enfocado (con Tab, por
 * ejemplo), lo deja por encima de la barra y no debajo (WCAG 2.4.7 y 2.4.11).
 *
 * Se usa tal cual, `ref={reservarAbajo}`: es una función estable y React llama a lo que devuelve
 * al desmontar.
 */
export function reservarAbajo(el: HTMLElement | null): (() => void) | undefined {
  if (!el) return undefined;
  const raiz = document.documentElement;
  const poner = () => {
    // offsetHeight y `bottom` no cambian con las animaciones de entrada (transform), al contrario
    // que getBoundingClientRect.
    const separacion = parseFloat(getComputedStyle(el).bottom) || 0;
    raiz.style.setProperty("--reserva-abajo", `${Math.ceil(el.offsetHeight + separacion)}px`);
  };
  poner();
  const observador = new ResizeObserver(poner);
  observador.observe(el);
  window.addEventListener("resize", poner);
  return () => {
    observador.disconnect();
    window.removeEventListener("resize", poner);
    raiz.style.removeProperty("--reserva-abajo");
  };
}
