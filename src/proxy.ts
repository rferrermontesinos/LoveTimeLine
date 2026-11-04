import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Todo menos la API, los archivos internos de Next y los estáticos con extensión.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
