/**
 * Folleto de instrucciones: una hoja de 252 × 176 mm (4 × 2 paneles de 63 × 88 mm, el tamaño
 * de una carta) que se pliega en mapa y cabe en la caja.
 *
 * Plegado: primero por la mitad a lo largo, con la cara A fuera; después en acordeón por las
 * tres líneas verticales, con la portada (panel inferior derecho de la cara A) delante.
 *
 * Por eso la fila superior de la cara A se imprime girada 180°: al abrir la portada se leen
 * derechas y en orden las reglas (R1 → R4); al dar la vuelta a la tira, los modos (M1 → M3)
 * y la portada; y al abrir el pliegue largo, la cara B es un póster con la dedicatoria.
 */
import type { CSSProperties, ReactNode } from "react";
import type { TextosFolleto } from "@/lib/carta/textos";

export interface ColoresFolleto {
  /** Color de la tinta del mazo (pestañas, reverso). */
  fondo: string;
  franja: string;
  texto: string;
  tinta: string;
  papel: string;
}

export interface Personalizacion {
  titulo: string;
  anios: string;
  dedicatoria: string;
}

const PANEL = "relative h-[88mm] w-[63mm] shrink-0 overflow-hidden";
const CUERPO = "text-[7pt] leading-[1.32]";

function Pestana({ children, color, texto }: { children: ReactNode; color: string; texto: string }) {
  return (
    <span className="tipo-titular absolute left-0 top-0 flex h-[13mm] w-[9.5mm] items-start rounded-[0_0_2.6mm_0] pl-[1.9mm] pt-[1.3mm] text-[19pt] leading-[0.85]" style={{ background: color, color: texto }}>
      {children}
    </span>
  );
}

function Franja({ color, activas, celda, alto = "2.6mm" }: { color: string; activas: (i: number) => boolean; celda: string; alto?: string }) {
  return (
    <span className="flex items-center gap-[0.5mm] rounded-[0.6mm] px-[0.9mm]" style={{ background: color, height: alto }}>
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="h-[45%] flex-1 rounded-[0.3mm]" style={{ background: activas(i) ? "#141414" : celda }} />
      ))}
    </span>
  );
}

function Titulo({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`tipo-subtitular text-[11pt] leading-[1.05] ${className}`}>{children}</h3>;
}

/** Carta en miniatura vista por el reverso, para los esquemas. */
function MiniReverso({ anio, mes, c, girada = 0 }: { anio: string; mes: number | null; c: ColoresFolleto; girada?: number }) {
  return (
    <span className="relative block h-[17mm] w-[12.2mm] overflow-hidden rounded-[1mm] shadow-[0_0.4mm_1mm_rgba(20,20,20,.25)]" style={{ background: c.fondo, transform: `rotate(${girada}deg)` }}>
      <span className="absolute inset-x-0 top-0 block h-[9mm] bg-[#9A9385]" />
      <span className="absolute inset-x-[0.8mm] top-[9.6mm]">
        <Franja color={c.franja} celda="rgba(245,240,230,.7)" activas={(i) => (mes === null ? true : i === mes - 1)} alto="1.6mm" />
      </span>
      <span className="tipo-titular absolute bottom-[0.6mm] left-[0.9mm] text-[9pt] leading-none" style={{ color: c.texto }}>
        {anio}
      </span>
    </span>
  );
}

/* ───────────────────────── Cara A ───────────────────────── */

/** Años para el abanico de la portada: los extremos del mazo si los hay, si no unos de ejemplo. */
function aniosAbanico(p: Personalizacion | null): [string, string, string] {
  const extremos = p?.anios.match(/\d{4}/g) ?? [];
  const desde = extremos[0];
  const hasta = extremos[extremos.length - 1];
  if (desde && hasta && desde !== hasta) return [desde, "?", hasta];
  return ["1998", "?", "2024"];
}

function Portada({ t, c, p }: { t: TextosFolleto; c: ColoresFolleto; p: Personalizacion | null }) {
  return (
    <div className={PANEL} style={{ background: c.tinta, color: c.papel }}>
      <Pestana color={c.fondo} texto={c.texto}>
        ?
      </Pestana>
      <div className="absolute inset-x-[4mm] top-[19mm]">
        <p className="tipo-micro text-[5.5pt] tracking-[0.14em]" style={{ color: c.fondo }}>
          {t.instrucciones.portadaSub}
        </p>
        <h2 className="tipo-titular mt-[2mm] text-[25pt] leading-[0.9]">{t.instrucciones.portadaTitulo}</h2>
        {p?.titulo && <p className="mt-[3mm] text-[8pt] font-semibold leading-tight opacity-90">{p.titulo}</p>}
        {p?.anios && <p className="tipo-micro mt-[1mm] text-[5pt] tracking-[0.12em] opacity-70">{p.anios}</p>}
      </div>
      {/* Tres cartas en abanico: anticipan el gesto del juego sin tapar el título. */}
      <div aria-hidden="true" className="absolute bottom-[14.5mm] left-1/2 flex -translate-x-1/2 items-end">
        {aniosAbanico(p).map((anio, i) => (
          <span key={i} className={i === 1 ? "relative z-10 mx-[0.8mm] -translate-y-[1.2mm]" : ""}>
            <MiniReverso anio={anio} mes={i === 1 ? null : i === 0 ? 4 : 9} c={c} girada={(i - 1) * 8} />
          </span>
        ))}
      </div>
      <div className="absolute inset-x-[4mm] bottom-[4mm] space-y-[2mm]">
        <Franja color={c.franja} celda="rgba(245,240,230,.7)" activas={() => true} />
        <p className="tipo-micro text-[5.5pt] tracking-[0.14em] opacity-80">{t.marca}</p>
      </div>
    </div>
  );
}

function Regla({ n, c, children }: { n: number; c: ColoresFolleto; children: ReactNode }) {
  return (
    <div className={PANEL} style={{ background: c.papel, color: c.tinta }}>
      <Pestana color={c.fondo} texto={c.texto}>
        {n}
      </Pestana>
      <div className="absolute inset-x-[4mm] bottom-[4mm] top-[16mm] space-y-[2.4mm]">{children}</div>
    </div>
  );
}

function Modo({ nombre, jugadores, texto, color }: { nombre: string; jugadores: string; texto: string; color: string }) {
  return (
    <div className="space-y-[1mm]">
      <p className="flex items-baseline gap-[1.6mm]">
        <span className="inline-block h-[2.4mm] w-[2.4mm] shrink-0 translate-y-[0.2mm] rounded-[0.5mm]" style={{ background: color }} />
        <span className="tipo-titular text-[12pt] leading-none">{nombre}</span>
      </p>
      <p className="tipo-micro text-[5pt] tracking-[0.12em] opacity-70">{jugadores}</p>
      <p className={`${CUERPO} opacity-90`}>{texto}</p>
    </div>
  );
}

function PanelModos({ c, children, cabecera }: { c: ColoresFolleto; children: ReactNode; cabecera?: ReactNode }) {
  return (
    <div className={PANEL} style={{ background: c.tinta, color: c.papel }}>
      <div className="absolute inset-[4mm] space-y-[3mm]">
        {cabecera}
        {children}
      </div>
    </div>
  );
}

export function CaraA({ t, c, p }: { t: TextosFolleto; c: ColoresFolleto; p: Personalizacion | null }) {
  const j = t.juego;
  const m = t.modos;
  const iconos: { color: string; simbolo: ReactNode; texto: string }[] = [
    { color: c.tinta, simbolo: <EstrellaSvg color="#F7739E" />, texto: `${j.mecanicas.estrella.nombre}: ${j.mecanicas.estrella.clasico}` },
    { color: "#E8402F", simbolo: <span className="tipo-titular text-[7pt] text-[#141414]">★</span>, texto: `${j.mecanicas.comodin.nombre}: ${j.mecanicas.comodin.clasico}` },
    { color: "transparent", simbolo: <span className="tipo-titular text-[8pt]">+</span>, texto: `${j.mecanicas.enBlanco.nombre}: ${j.mecanicas.enBlanco.texto}` },
  ];
  return (
    <div className="flex h-[176mm] w-[252mm] flex-col">
      {/* Fila superior: reglas, girada 180° para que se lean derechas al abrir la portada. */}
      <div className="flex rotate-180">
        <Regla n={1} c={c}>
          <Titulo>{j.componentes}</Titulo>
          <p className={CUERPO}>{j.componentesTexto}</p>
          <Titulo className="pt-[1mm]">{j.preparacion}</Titulo>
          <p className={CUERPO}>{j.clasico.preparacion.join(" ")}</p>
        </Regla>
        <Regla n={2} c={c}>
          <Titulo>{j.turno}</Titulo>
          <p className={CUERPO}>{j.clasico.turno.join(" ")}</p>
          <div className="relative mt-[3mm] flex items-end justify-center gap-[2.2mm] pt-[9mm]">
            <MiniReverso anio="2015" mes={5} c={c} />
            <span className="absolute left-1/2 top-0 -translate-x-1/2">
              <span className="relative block -rotate-6">
                <span className="block h-[17mm] w-[12.2mm] rounded-[1mm] border-[0.35mm] border-dashed" style={{ borderColor: c.tinta }} />
              </span>
            </span>
            <MiniReverso anio="2021" mes={12} c={c} />
          </div>
          <p className="tipo-micro flex justify-between px-[2mm] text-[5pt] tracking-[0.12em]">
            <span>← {t.instrucciones.antes}</span>
            <span>{t.instrucciones.despues} →</span>
          </p>
        </Regla>
        <Regla n={3} c={c}>
          <Titulo>{j.fechas}</Titulo>
          <p className={CUERPO}>{j.fechasTexto}</p>
          <div className="flex justify-between pt-[2mm]">
            <MiniReverso anio="2019" mes={8} c={c} girada={-4} />
            <MiniReverso anio="2015" mes={5} c={c} />
            <MiniReverso anio="2008" mes={null} c={c} girada={4} />
          </div>
        </Regla>
        <Regla n={4} c={c}>
          <Titulo>{j.final}</Titulo>
          <p className={CUERPO}>{j.clasico.final.join(" ")}</p>
          <Titulo className="pt-[1mm]">{j.mecanicas.titulo}</Titulo>
          <ul className="space-y-[1.6mm]">
            {iconos.map((i, k) => (
              <li key={k} className="flex gap-[1.8mm]">
                <span className="grid h-[4.6mm] w-[4.6mm] shrink-0 place-items-center rounded-full" style={{ background: i.color, border: i.color === "transparent" ? `0.3mm dashed ${c.tinta}` : undefined }}>
                  {i.simbolo}
                </span>
                <span className="text-[6.3pt] leading-[1.28]">{i.texto}</span>
              </li>
            ))}
          </ul>
        </Regla>
      </div>
      {/* Fila inferior: modos y, a la derecha, la portada del folleto plegado. */}
      <div className="flex">
        <PanelModos
          c={c}
          cabecera={
            <>
              <h3 className="tipo-titular text-[15pt] leading-[0.95]" style={{ color: c.fondo }}>
                {j.tiposTitulo}
              </h3>
              <p className={`${CUERPO} opacity-85`}>{j.tiposTexto}</p>
            </>
          }
        >
          <Modo nombre={m.historia.nombre} jugadores={`${m.historia.etiqueta} · ${m.historia.jugadores}`} texto={j.historia.preparacion.join(" ")} color="#22A861" />
        </PanelModos>
        <PanelModos c={c}>
          <Modo nombre={j.turno} jugadores={m.historia.nombre} texto={j.historia.turno.join(" ")} color="#22A861" />
          <Modo nombre={j.final} jugadores={m.historia.nombre} texto={j.historia.final.join(" ")} color="#22A861" />
        </PanelModos>
        <PanelModos c={c}>
          <Modo nombre={j.historia.completa} jugadores={m.historia.nombre} texto={j.historia.completaTexto} color="#F5F0E6" />
          <p className="rounded-[1.6mm] p-[2mm] text-[6.6pt] font-semibold leading-[1.3]" style={{ background: "#FFC93C", color: "#141414" }}>
            {j.consejo}
          </p>
        </PanelModos>
        <Portada t={t} c={c} p={p} />
      </div>
    </div>
  );
}

/* ───────────────────────── Cara B: póster ───────────────────────── */

export function CaraB({ t, c, p }: { t: TextosFolleto; c: ColoresFolleto; p: Personalizacion | null }) {
  const ti = t.instrucciones;
  const estilo: CSSProperties = { background: c.fondo, color: c.texto };
  return (
    <div className="relative h-[176mm] w-[252mm] overflow-hidden" style={estilo}>
      {/* Titular gigante sobre la fila superior. */}
      <div className="absolute left-[7mm] right-[7mm] top-[8mm]">
        <p className="tipo-micro text-[6pt] tracking-[0.16em] opacity-80">{t.marca}</p>
        <h2 className="tipo-titular mt-[2mm] text-[74pt] leading-[0.86]">{ti.posterTitulo}</h2>
        <p className="mt-[3mm] max-w-[110mm] text-[10pt] font-semibold leading-snug">{ti.posterTexto}</p>
      </div>
      <div className="absolute left-[7mm] right-[7mm] top-[74mm]">
        <Franja color={c.franja} celda="rgba(245,240,230,.7)" activas={() => true} alto="5mm" />
      </div>

      {/* Fila inferior, panel 1: récord del modo cooperativo. */}
      <div className="absolute left-[4mm] top-[92mm] h-[80mm] w-[55mm] rounded-[2.5mm] p-[3.5mm]" style={{ background: c.papel, color: c.tinta }}>
        <p className="tipo-subtitular text-[9pt] leading-tight">{ti.lineas}</p>
        <div className="mt-[2.5mm] grid grid-cols-[1fr_0.7fr_1.3fr] gap-x-[1.5mm] text-[5.5pt]">
          <span className="tipo-micro tracking-[0.1em]">{ti.fecha}</span>
          <span className="tipo-micro tracking-[0.1em]">{ti.cartas}</span>
          <span className="tipo-micro tracking-[0.1em]">{ti.quienes}</span>
        </div>
        <div className="mt-[1mm] space-y-[6.4mm] pt-[5mm]">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="block border-b-[0.25mm]" style={{ borderColor: c.tinta }} />
          ))}
        </div>
      </div>

      {/* Paneles 2 y 3: título del mazo. */}
      <div className="absolute left-[67mm] top-[96mm] w-[118mm]">
        {p?.titulo ? (
          <>
            <p className="tipo-titular text-[26pt] leading-[0.92]">{p.titulo}</p>
            {p.anios && <p className="tipo-titular mt-[2mm] text-[16pt] leading-none opacity-90">{p.anios}</p>}
          </>
        ) : (
          <div className="space-y-[3mm]">
            <p className="tipo-micro text-[6pt] tracking-[0.16em] opacity-80">{ti.mazoDe}</p>
            <span className="block h-[12mm] border-b-[0.3mm] border-dashed" style={{ borderColor: c.texto }} />
            <p className="tipo-micro pt-[3mm] text-[6pt] tracking-[0.16em] opacity-80">{ti.mazoAnios}</p>
            <span className="block h-[8mm] w-[46mm] border-b-[0.3mm] border-dashed" style={{ borderColor: c.texto }} />
          </div>
        )}
      </div>

      {/* Panel 4: dedicatoria. */}
      <div className="absolute right-[4mm] top-[92mm] h-[80mm] w-[55mm] rounded-[2.5mm] p-[3.5mm]" style={{ background: c.papel, color: c.tinta }}>
        <p className="tipo-micro text-[5.5pt] tracking-[0.14em]">{ti.dedicatoriaPara}</p>
        <span className="mt-[5mm] block border-b-[0.25mm]" style={{ borderColor: c.tinta }} />
        {p?.dedicatoria ? (
          <p className="mt-[4mm] whitespace-pre-line text-[8.5pt] leading-[1.35]">{p.dedicatoria}</p>
        ) : (
          <div className="mt-[4mm] space-y-[6mm] pt-[3mm]">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="block border-b-[0.25mm]" style={{ borderColor: c.tinta }} />
            ))}
          </div>
        )}
        <p className="tipo-micro absolute bottom-[10mm] left-[3.5mm] text-[5.5pt] tracking-[0.14em]">{ti.dedicatoriaDe}</p>
        <span className="absolute bottom-[5mm] left-[3.5mm] right-[3.5mm] block border-b-[0.25mm]" style={{ borderColor: c.tinta }} />
      </div>
    </div>
  );
}

function EstrellaSvg({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[3mm] w-[3mm]" style={{ fill: color }} aria-hidden="true">
      <path d="M12 2.2l2.92 6.26 6.86.78-5.1 4.66 1.4 6.76L12 17.25 5.92 20.66l1.4-6.76-5.1-4.66 6.86-.78L12 2.2z" />
    </svg>
  );
}

