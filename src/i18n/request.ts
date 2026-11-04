import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { MENSAJES } from "../../messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const solicitado = await requestLocale;
  const locale = hasLocale(routing.locales, solicitado) ? solicitado : routing.defaultLocale;
  return {
    locale,
    messages: MENSAJES[locale],
    timeZone: "Europe/Madrid",
  };
});
