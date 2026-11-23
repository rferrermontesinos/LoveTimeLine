import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PaginaFolleto } from "@/components/instrucciones/PaginaFolleto";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { textosInternos } from "@/lib/carta/textosInternos";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = textosInternos(locale).folleto;
  return { title: t.titulo, description: t.texto, robots: { index: false, follow: false, nocache: true } };
}

/** Folleto plegable para imprimir con el packaging. `?generico=1`: sin datos de ningún mazo. */
export default async function Folleto({
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
  const mecanicas = catalogo.mecanicas
    .filter((m) => m.activo)
    .sort((a, b) => a.orden - b.orden)
    .map((m) => ({ id: m.id, icono: m.icono ?? null, cartasFisicas: m.cartasFisicas }));
  return (
    <>
      <div className="print:hidden">
        <CintaPrototipo />
        <Cabecera ocultarCta />
      </div>
      <main id="contenido">
        <PaginaFolleto generico={consulta.generico === "1"} mecanicas={mecanicas} />
      </main>
    </>
  );
}
