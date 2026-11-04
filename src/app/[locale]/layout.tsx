import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BRAND_NAME } from "@config/brand";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: t("titulo", { marca: BRAND_NAME }), template: `%s · ${BRAND_NAME}` },
    description: t("descripcion"),
    robots: { index: false, follow: false },
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) },
    icons: { icon: "/icono.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: "#F5F0E6",
  width: "device-width",
  initialScale: 1,
};

export default async function LayoutIdioma({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "nav" });
  return (
    <html lang={locale}>
      <head>
        <link rel="preload" href="/fonts/ui/bricolage-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-tinta focus:px-4 focus:py-2 focus:text-papel">
          {t("saltar")}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
