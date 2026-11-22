import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { COOKIE_ACCESO, decidirAcceso, DURACION_COOKIE_S, HTML_ACCESO_DENEGADO } from "./lib/servidor/acceso";

const idiomas = createMiddleware(routing);

/** Primero el acceso privado del prototipo (ver lib/servidor/acceso.ts); después, el idioma. */
export default async function proxy(req: NextRequest) {
  const decision = await decidirAcceso({ clave: process.env.CLAVE_ACCESO, url: req.nextUrl, cookie: req.cookies.get(COOKIE_ACCESO)?.value });

  if (decision.tipo === "denegar") {
    return new NextResponse(HTML_ACCESO_DENEGADO, {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (decision.tipo === "entrar") {
    const destino = req.nextUrl.clone();
    destino.search = decision.destino.search;
    const res = NextResponse.redirect(destino);
    res.cookies.set(COOKIE_ACCESO, decision.huella, {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
      sameSite: "lax",
      path: "/",
      maxAge: DURACION_COOKIE_S,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // El idioma solo se resuelve en las páginas: la API y las rutas con punto (las variantes internas
  // de una página, …/pagina.rsc y …/pagina.segments/…) ya han pasado por el acceso y siguen tal cual.
  const { pathname } = req.nextUrl;
  return pathname.startsWith("/api") || pathname.includes(".") ? NextResponse.next() : idiomas(req);
}

export const config = {
  // Todo pasa por el acceso menos los archivos estáticos que no tienen nada privado: los de Next,
  // las fuentes, las fotos de muestra, el service worker, el icono y robots.txt. No se excluye «lo
  // que tenga un punto»: las variantes internas de cada página (…/pagina.segments/…segment.rsc)
  // devuelven su contenido y en Vercel se servían sin la cookie (comprobado el 22-11-2026).
  // Cada cambio aquí, con su prueba en src/lib/servidor/acceso.test.ts.
  matcher: "/((?!_next/|_vercel/|fonts/|muestras/|juego/|sw\\.js|icono\\.svg|robots\\.txt|favicon\\.ico).*)",
};
