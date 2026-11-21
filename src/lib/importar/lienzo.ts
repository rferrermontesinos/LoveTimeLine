/** Lienzo de trabajo fuera de pantalla cuando el navegador lo permite. */
export interface LienzoTrabajo {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  aBlob: (tipo: string, calidad: number) => Promise<Blob>;
  canvas: HTMLCanvasElement | OffscreenCanvas;
}

export function crearLienzo(ancho: number, alto: number): LienzoTrabajo {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(ancho, alto);
    const ctx = canvas.getContext("2d");
    if (ctx) return { canvas, ctx, aBlob: (type, quality) => canvas.convertToBlob({ type, quality }) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d")!;
  return {
    canvas,
    ctx,
    aBlob: (type, quality) =>
      new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error("toBlob"))), type, quality)),
  };
}
