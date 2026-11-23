/**
 * Lo que hace la ruta /api/enlaces (ver src/app/api/enlaces/route.ts): pasa al servicio de la
 * subida colaborativa la petición de crear un enlace, con el secreto del portal. No guarda nada.
 */

/** Lo que manda el navegador del dueño: su clave pública y la huella de su token (unos 150 bytes). */
const MAX_CUERPO = 4096;

const respuesta = (cuerpo: unknown, estado: number) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function crearEnlaceEnServicio(
  req: Request,
  o: { base: string | null; secreto: string | undefined; buscar?: typeof fetch },
): Promise<Response> {
  if (!o.base) return respuesta({ error: "no-existe" }, 404);
  const cuerpo = await req.text();
  if (cuerpo.length > MAX_CUERPO) return respuesta({ error: "formato" }, 400);
  // En local, el servicio es una ruta de la propia web («/api/colaboracion»).
  const destino = new URL(`${o.base}/invitaciones`, req.url);
  let r: Response;
  try {
    r = await (o.buscar ?? fetch)(destino, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(o.secreto ? { "x-clave-servicio": o.secreto } : {}) },
      body: cuerpo,
      cache: "no-store",
    });
  } catch {
    return respuesta({ error: "red" }, 502);
  }
  const texto = await r.text();
  return new Response(texto, { status: r.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
