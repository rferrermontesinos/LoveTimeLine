/**
 * Acceso privado al portal mientras sea un prototipo.
 *
 * Con `CLAVE_ACCESO` en el entorno del servidor, solo entra quien abre una vez el enlace secreto
 * (`https://…/?acceso=<clave>`): el proxy guarda en ese navegador una cookie con la huella de la
 * clave y quita la clave de la dirección. Sin cookie válida, las páginas y la API responden 403.
 * Cambiar la clave deja fuera todos los navegadores que ya habían entrado.
 *
 * Sin la variable no hay bloqueo: desarrollo local y tests.
 */

export const PARAM_ACCESO = "acceso";
export const COOKIE_ACCESO = "acceso_prototipo";
export const DURACION_COOKIE_S = 60 * 60 * 24 * 90;

/** Rutas que nunca se bloquean: Stripe no lleva la cookie y su webhook ya va firmado. */
const RUTAS_LIBRES = ["/api/stripe/webhook"];

export type DecisionAcceso =
  | { tipo: "pasar" }
  | { tipo: "entrar"; destino: URL; huella: string }
  | { tipo: "denegar" };

/** Huella SHA-256 de la clave: es lo que se guarda en la cookie, nunca la clave. */
export async function huellaClave(clave: string): Promise<string> {
  const datos = new TextEncoder().encode(`acceso-prototipo:${clave}`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante para cadenas de la misma longitud. */
export function igualesSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

export async function decidirAcceso(e: { clave: string | undefined; url: URL; cookie: string | undefined }): Promise<DecisionAcceso> {
  const clave = e.clave?.trim();
  if (!clave) return { tipo: "pasar" };
  if (RUTAS_LIBRES.some((r) => e.url.pathname === r)) return { tipo: "pasar" };

  const huella = await huellaClave(clave);
  const enEnlace = e.url.searchParams.get(PARAM_ACCESO);
  if (enEnlace !== null && igualesSeguro(await huellaClave(enEnlace.trim()), huella)) {
    const destino = new URL(e.url.href);
    destino.searchParams.delete(PARAM_ACCESO);
    return { tipo: "entrar", destino, huella };
  }
  if (e.cookie && igualesSeguro(e.cookie, huella)) return { tipo: "pasar" };
  return { tipo: "denegar" };
}

/** Página mínima para quien llega sin el enlace: no dice qué hay detrás. */
export const HTML_ACCESO_DENEGADO = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Acceso privado</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #F5F0E6; color: #2B2420; font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 26rem; padding: 2rem 1.5rem; text-align: center; }
  h1 { font-size: 1.4rem; margin: 0 0 .75rem; }
  p { margin: 0 0 .5rem; }
  p[lang="en"] { color: #6B5F57; }
</style>
</head>
<body>
<main>
  <h1>Acceso privado</h1>
  <p>Esta web es un prototipo privado. Para entrar, abre el enlace completo que te enviaron.</p>
  <p lang="en">This site is a private prototype. To get in, open the full link you were sent.</p>
</main>
</body>
</html>`;
