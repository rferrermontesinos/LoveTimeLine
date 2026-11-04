import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { BRAND_NAME } from "@config/brand";
import { Link } from "@/i18n/navigation";
import { clasesBoton } from "@/components/ui/Boton";
import { SelectorIdioma } from "./SelectorIdioma";

export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className="tipo-titular relative inline-flex h-8 w-6 items-start rounded-[0_0_8px_0] bg-rosa pl-1 pt-0.5 text-[17px] leading-[0.85]">
        ?
      </span>
      <span className="tipo-titular text-[1.45rem] leading-none">{BRAND_NAME}</span>
    </span>
  );
}

export async function CintaPrototipo() {
  const t = await getTranslations("nav");
  return (
    <div className="bg-amarillo text-tinta">
      <p className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-1.5 text-sm sm:px-6">
        <strong className="tipo-micro text-micro">{t("prototipo")}</strong>
        <span className="text-[0.8125rem]">{t("prototipoDetalle")}</span>
      </p>
    </div>
  );
}

export async function Cabecera({ ocultarCta = false }: { ocultarCta?: boolean }) {
  const t = await getTranslations("nav");
  return (
    <header className="sticky top-0 z-30 border-b border-linea/80 bg-papel/92 backdrop-blur supports-[backdrop-filter]:bg-papel/80">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label={`${BRAND_NAME}, ${t("inicio")}`}>
          <Marca />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
          <Link href="/como-jugar" className="tipo-boton hidden min-h-10 items-center rounded-full px-3 text-sm hover:bg-papel-2 md:inline-flex">
            {t("comoJugar")}
          </Link>
          <Link href="/#precios" className="tipo-boton hidden min-h-10 items-center rounded-full px-3 text-sm hover:bg-papel-2 md:inline-flex">
            {t("precios")}
          </Link>
          <Suspense fallback={null}>
            <SelectorIdioma />
          </Suspense>
          {!ocultarCta && (
            <Link href="/crear" className={clasesBoton("primario", "sm", "ml-1")}>
              {t("crear")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
