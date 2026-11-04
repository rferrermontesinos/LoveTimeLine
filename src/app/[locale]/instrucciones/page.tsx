import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaginaInstrucciones } from "@/components/instrucciones/PaginaInstrucciones";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { Pie } from "@/components/marco/Pie";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "instrucciones" });
  return { title: t("titulo"), description: t("texto") };
}

export default async function Instrucciones({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const consulta = await searchParams;
  return (
    <>
      <div className="print:hidden">
        <CintaPrototipo />
        <Cabecera />
      </div>
      <main id="contenido">
        <PaginaInstrucciones generico={consulta.generico === "1"} />
      </main>
      <div className="print:hidden">
        <Pie />
      </div>
    </>
  );
}
