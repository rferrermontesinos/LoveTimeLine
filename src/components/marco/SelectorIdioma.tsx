"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function SelectorIdioma({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const ruta = usePathname();
  const params = useSearchParams();
  const t = useTranslations("nav");
  const otro = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;
  const query = params.toString();
  return (
    <Link
      href={query ? `${ruta}?${query}` : ruta}
      locale={otro}
      hrefLang={otro}
      lang={otro}
      className={`tipo-boton inline-flex min-h-10 items-center rounded-full px-3 text-sm hover:bg-papel-2 ${className}`}
      aria-label={`${t("idioma")}: ${t("cambiarIdioma")}`}
    >
      {t("cambiarIdioma")}
    </Link>
  );
}
