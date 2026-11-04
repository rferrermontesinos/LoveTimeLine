import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { Pie } from "@/components/marco/Pie";
import { PedidoConfirmado } from "@/components/pedido/PedidoConfirmado";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "confirmado" });
  return { title: t("tituloSimulado") };
}

export default async function PaginaConfirmado({
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
  return (
    <>
      <CintaPrototipo />
      <Cabecera ocultarCta />
      <main id="contenido">
        <PedidoConfirmado catalogo={catalogo} sessionId={typeof consulta.session_id === "string" ? consulta.session_id : null} />
      </main>
      <Pie />
    </>
  );
}
