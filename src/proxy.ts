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

  return req.nextUrl.pathname.startsWith("/api") ? NextResponse.next() : idiomas(req);
}

export const config = {
  // Páginas y API. Fuera quedan los archivos internos de Next y los estáticos con extensión
  // (robots.txt, sw.js, fuentes, fotos de muestra), que no tienen nada privado.
  matcher: "/((?!_next|_vercel|.*\\..*).*)",
};
