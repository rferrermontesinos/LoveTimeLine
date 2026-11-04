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

export default async function PaginaCrear({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const consulta = await searchParams;
  const catalogo = await obtenerCatalogo();
  const pack = typeof consulta.pack === "string" ? consulta.pack : null;
  return (
    <>
      <CintaPrototipo />
      <Cabecera ocultarCta />
      <Configurador catalogo={catalogo} packInicial={pack} pagoCancelado={consulta.pago === "cancelado"} />
    </>
  );
}
