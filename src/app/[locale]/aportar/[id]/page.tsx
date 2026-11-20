import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { URL_COLABORACION } from "@config/colaboracion";
import { Aportar } from "@/components/aportar/Aportar";
import { CintaPrototipo, Marca } from "@/components/marco/Cabecera";
import { esIdEnlace } from "@/lib/colaboracion/enlace";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "colaboracion.aportar" });
  // Nunca en buscadores, y sin decir de dónde se viene al seguir un enlace.
  return { title: t("metaTitulo"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * Página para mandar fotos a un mazo con el enlace que comparte quien lo hace (subida
 * colaborativa). La abre gente sin la clave del prototipo: no enlaza a ninguna otra página.
 */
export default async function PaginaAportar({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!URL_COLABORACION || !esIdEnlace(id)) notFound();
  const t = await getTranslations("colaboracion.aportar");
  return (
    <>
      <CintaPrototipo />
      <header className="border-b border-linea/80">
        <div className="mx-auto flex h-16 max-w-[760px] items-center px-4 sm:px-6">
          <Marca />
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-[760px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Aportar id={id} />
      </main>
      <footer className="border-t border-linea/80">
        <p className="mx-auto max-w-[760px] px-4 py-6 text-sm text-tinta-2 sm:px-6">{t("pie")}</p>
      </footer>
    </>
  );
}
