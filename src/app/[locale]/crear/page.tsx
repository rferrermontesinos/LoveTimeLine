import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Configurador } from "@/components/crear/Configurador";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "crear" });
  return { title: t("titulo") };
}

// El catálogo (packs y precios) se lee en cada petición, no al compilar.
export const dynamic = "force-dynamic";

/**
 * `?pack=` (desde la portada) y `?pago=cancelado` (vuelta de Stripe) los lee el configurador en el
 * navegador: los quita de la URL en cuanto los usa, y como props del servidor volverían con
 * «Atrás» y se aplicarían otra vez.
 */
export default async function PaginaCrear({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const catalogo = await obtenerCatalogo();
  return (
    <>
      <CintaPrototipo />
      <Cabecera ocultarCta />
      <Configurador catalogo={catalogo} />
    </>
  );
}
