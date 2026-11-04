/**
 * Folleto de instrucciones: una hoja de 252 × 176 mm (4 × 2 paneles de 63 × 88 mm, el tamaño
 * de una carta) que se pliega en mapa y va dentro de la caja. No está en la web pública: se
 * imprime con el packaging desde la herramienta interna /interno/folleto.
 *
 * Plegado: primero por la mitad a lo largo, con la cara A fuera; después en acordeón por las
 * tres líneas verticales, con la portada (panel inferior derecho de la cara A) delante.
 *
 * Por eso la fila superior de la cara A se imprime girada 180°: al abrir la portada se leen
 * derechas y en orden las reglas del Clásico y los iconos (1 → 4); al dar la vuelta a la tira,
 * Nuestra historia (5 → 7) y la portada; y al abrir el pliegue largo, la cara B es un póster.
 *
 * Los textos salen de messages/<idioma>/juego.json (las reglas) e instrucciones.json (lo propio
 * del folleto). Solo el comodín va resumido en instrucciones.comodin para que quepa en su panel:
 * si cambian sus reglas en juego.json, hay que cambiar también el resumen. En la versión
 * personalizada, las personas y las vidas salen del número de cartas del mazo
 * (src/domain/juego/reglas.ts).
 */
import type { CSSProperties, ReactNode } from "react";
import { IconoMecanica } from "@/components/ui/IconoMecanica";
import { jugadoresPorMazo, vidas, vidasHistoriaCompleta } from "@/domain/juego/reglas";
import type { TextosFolleto } from "@/lib/carta/textos";

export interface ColoresFolleto {
  /** Color de la paleta (pestañas y reverso de las cartas) y texto sobre él. */
  fondo: string;
  texto: string;
  tinta: string;
  papel: string;
  /** Estilo y paleta, para pintar los iconos de la esquina igual que en las cartas. */
  estiloId: string;
  paletaId: string;
}

export interface Personalizacion {
  titulo: string;
  anios: string;
  dedicatoria: string;
  /** Cartas de recuerdo del mazo: marcan cuántas personas caben y las vidas. */
  cartas: number;
  /** Mecánicas elegidas: el folleto solo explica las que lleva el mazo. */
  mecanicas: string[];
}

/** Mecánica del catálogo y su icono de la plantilla, en el orden del catálogo. */
export interface MecanicaFolleto {
  id: string;
  icono: string | null;
}

/** Colores de los dos tipos de juego, como en «Cómo se juega». */
const COLOR_MODO = { clasico: "#FFC93C", historia: "#22A861" } as const;
/** Clave de cada mecánica en juego.json (`mecanicas.<clave>`). */
const CLAVE_MECANICA: Record<string, "estrella" | "comodin" | "enBlanco"> = { estrella: "estrella", comodin: "comodin", "en-blanco": "enBlanco" };

const PANEL = "relative h-[88mm] w-[63mm] shrink-0 overflow-hidden";
const CUERPO = "text-[6.8pt] leading-[1.3]";

function Pestana({ children, color, texto }: { children: ReactNode; color: string; texto: string }) {
  return (
    <span className="tipo-titular absolute left-0 top-0 flex h-[13mm] w-[9.5mm] items-start rounded-[0_0_2.6mm_0] pl-[1.9mm] pt-[1.3mm] text-[19pt] leading-[0.85]" style={{ background: color, color: texto }}>
      {children}
    </span>
  );
}

function Titulo({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`tipo-subtitular text-[10.5pt] leading-[1.05] ${className}`}>{children}</h3>;
}

/**
 * Zona de texto de un panel: empieza arriba, a la derecha de la pestaña numerada, y el texto la
 * rodea por debajo (un hueco flotante del tamaño de la pestaña). Así cabe más sin bajar la letra.
 */
function Contenido({ children }: { children: ReactNode }) {
  return (
    <div data-contenido className="absolute inset-x-[4mm] bottom-[4mm] top-[4.2mm]">
      <span aria-hidden="true" className="float-left mr-[2mm] h-[10mm] w-[5.5mm]" />
      <div className="space-y-[2mm]">{children}</div>
    </div>
  );
}

/** Pasos de una regla, uno por párrafo. */
function Pasos({ pasos, className = "" }: { pasos: string[]; className?: string }) {
  return (
    <div className={`space-y-[0.8mm] ${CUERPO} ${className}`}>
      {pasos.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

/** Cabecera de un tipo de juego: cuadrado de su color, nombre y «Cooperativo · De 2 a 6 personas». */
function CabeceraModo({ nombre, detalle, color }: { nombre: string; detalle: string; color: string }) {
  return (
    <div className="space-y-[0.8mm]">
      <p className="flex items-baseline gap-[1.6mm]">
        <span className="inline-block h-[2.4mm] w-[2.4mm] shrink-0 translate-y-[0.2mm] rounded-[0.5mm]" style={{ background: color }} />
        <span className="tipo-titular text-[13pt] leading-none">{nombre}</span>
      </p>
      <p className="tipo-micro text-[5pt] tracking-[0.12em] opacity-75">{detalle}</p>
    </div>
  );
}

/**
 * Carta en miniatura vista por detrás, como las de verdad: la foto arriba, la pestaña en la
 * esquina y el año grande abajo, sin franja.
 */
function MiniReverso({ anio, c, girada = 0 }: { anio: string; c: ColoresFolleto; girada?: number }) {
  return (
    <span className="relative block h-[17mm] w-[12.2mm] overflow-hidden rounded-[0.8mm] shadow-[0_0.4mm_1mm_rgba(20,20,20,.25)]" style={{ background: c.fondo, transform: `rotate(${girada}deg)` }}>
      <span className="absolute inset-x-0 top-0 block h-[10.8mm]" style={{ background: "linear-gradient(160deg, #B9B1A3, #857D70)" }} />
      <span className="absolute left-0 top-0 block h-[3.9mm] w-[2.7mm] rounded-[0_0_0.8mm_0]" style={{ background: c.fondo }} />
      <span className="tipo-titular absolute bottom-[0.6mm] left-[0.9mm] text-[9pt] leading-none" style={{ color: c.texto }}>
        {anio}
      </span>
    </span>
  );
}

/** Años para el abanico de la portada: los extremos del mazo si los hay, si no unos de ejemplo. */
function aniosAbanico(p: Personalizacion | null): [string, string, string] {
  const extremos = p?.anios.match(/\d{4}/g) ?? [];
  const desde = extremos[0];
  const hasta = extremos[extremos.length - 1];
  if (desde && hasta && desde !== hasta) return [desde, "?", hasta];
  return ["1998", "?", "2024"];
}

/** «Fechas iguales o con solo el año», con tres cartas en orden como ejemplo de línea del tiempo. */
function BloqueFechas({ j, c }: { j: TextosFolleto["juego"]; c: ColoresFolleto }) {
  return (
    <>
      <Titulo className="pt-[0.6mm]">{j.fechas}</Titulo>
      <p className={CUERPO}>{j.fechasTexto}</p>
      <div aria-hidden="true" className="flex justify-between px-[3mm] pt-[1mm]">
        <MiniReverso anio="2008" c={c} girada={-4} />
        <MiniReverso anio="2015" c={c} />
        <MiniReverso anio="2019" c={c} girada={4} />
      </div>
    </>
  );
}

/** Rellena «{n}» y demás huecos de un texto del folleto. */
function con(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => String(valores[k] ?? `{${k}}`));
}

/** «De 2 a 4 personas» → «de 2 a 4 personas», para seguir una frase. */
function minusculaInicial(texto: string): string {
  return texto.charAt(0).toLocaleLowerCase() + texto.slice(1);
}

/* ───────────────────────── Cara A ───────────────────────── */

function Portada({ t, c, p }: { t: TextosFolleto; c: ColoresFolleto; p: Personalizacion | null }) {
  return (
    <div data-panel="portada" className={PANEL} style={{ background: c.tinta, color: c.papel }}>
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
      <div aria-hidden="true" className="absolute bottom-[11mm] left-1/2 flex -translate-x-1/2 items-end">
        {aniosAbanico(p).map((anio, i) => (
          <span key={i} className={i === 1 ? "relative z-10 mx-[0.8mm] -translate-y-[1.2mm]" : ""}>
            <MiniReverso anio={anio} c={c} girada={(i - 1) * 8} />
          </span>
        ))}
      </div>
      <p className="tipo-micro absolute bottom-[4mm] left-[4mm] text-[5.5pt] tracking-[0.14em] opacity-80">{t.marca}</p>
    </div>
  );
}

/** Panel de reglas: papel, con la pestaña numerada. */
function Regla({ n, c, children }: { n: number; c: ColoresFolleto; children: ReactNode }) {
  return (
    <div data-panel={`regla-${n}`} className={PANEL} style={{ background: c.papel, color: c.tinta }}>
      <Pestana color={c.fondo} texto={c.texto}>
        {n}
      </Pestana>
      <Contenido>{children}</Contenido>
    </div>
  );
}

/** Panel de Nuestra historia: tinta, con la pestaña numerada en verde. */
function PanelHistoria({ n, c, children }: { n: number; c: ColoresFolleto; children: ReactNode }) {
  return (
    <div data-panel={`historia-${n}`} className={PANEL} style={{ background: c.tinta, color: c.papel }}>
      <Pestana color={COLOR_MODO.historia} texto={c.tinta}>
        {n}
      </Pestana>
      <Contenido>{children}</Contenido>
    </div>
  );
}

export function CaraA({ t, c, p, mecanicas }: { t: TextosFolleto; c: ColoresFolleto; p: Personalizacion | null; mecanicas: MecanicaFolleto[] }) {
  const j = t.juego;
  const m = t.modos;
  const ti = t.instrucciones;
  const jugadores = p ? jugadoresPorMazo(p.cartas) : null;
  const visibles = mecanicas.filter((x) => CLAVE_MECANICA[x.id] && (!p || p.mecanicas.includes(x.id)));
  // Un mazo sin iconos deja libre el panel 4: las fechas pasan allí y el panel 1 respira.
  const fechasEnPanel4 = visibles.length === 0;

  return (
    <div className="flex h-[176mm] w-[252mm] flex-col">
      {/* Fila superior: para empezar, el Clásico y los iconos, girada 180° para que se lea derecha al abrir la portada. */}
      <div className="flex rotate-180">
        <Regla n={1} c={c}>
          <Titulo>{j.componentes}</Titulo>
          <p className={CUERPO}>{j.componentesTexto}</p>
          <Titulo className="pt-[0.6mm]">{j.jugadores.titulo}</Titulo>
          {jugadores && p ? (
            <p className={`${CUERPO} font-semibold`}>
              {con(ti.vuestroMazo, { n: p.cartas })}:{" "}
              {jugadores.recomendado > 2 ? minusculaInicial(con(j.jugadores.rango, { n: jugadores.recomendado })) : con(ti.personas, { n: jugadores.recomendado })}
              {jugadores.maximo > jugadores.recomendado && ` (${con(j.jugadores.maximo, { n: jugadores.maximo })})`}.
            </p>
          ) : (
            <p className={CUERPO}>{j.jugadores.texto}</p>
          )}
          <p className={CUERPO}>{j.jugadores.parejas}</p>
          {!fechasEnPanel4 && <BloqueFechas j={j} c={c} />}
        </Regla>
        <Regla n={2} c={c}>
          <CabeceraModo nombre={m.clasico.nombre} detalle={`${m.clasico.etiqueta} · ${m.clasico.jugadores}`} color={COLOR_MODO.clasico} />
          <p className={`${CUERPO} font-semibold`}>{m.clasico.resumen}</p>
          <Titulo className="pt-[0.6mm]">{j.preparacion}</Titulo>
          <Pasos pasos={j.clasico.preparacion} />
        </Regla>
        <Regla n={3} c={c}>
          <Titulo>{j.turno}</Titulo>
          <Pasos pasos={j.clasico.turno} />
          <Titulo className="pt-[0.6mm]">{j.final}</Titulo>
          <Pasos pasos={j.clasico.final} />
        </Regla>
        <Regla n={4} c={c}>
          {fechasEnPanel4 ? (
            <BloqueFechas j={j} c={c} />
          ) : (
            <>
              <Titulo>{j.mecanicas.titulo}</Titulo>
              <ul className="space-y-[1.8mm]">
                {visibles.map((x) => {
                  const clave = CLAVE_MECANICA[x.id]!;
                  const textos = j.mecanicas[clave];
                  return (
                    <li key={x.id} className="space-y-[0.6mm]">
                      <p className="flex items-center gap-[1.6mm]">
                        <IconoMecanica icono={x.icono} estiloId={c.estiloId} paletaId={c.paletaId} className="h-[4.6mm] w-[4.6mm]" />
                        <span className="tipo-subtitular text-[8pt] leading-none">{textos.nombre}</span>
                      </p>
                      {"texto" in textos ? (
                        <p className={CUERPO}>{textos.texto}</p>
                      ) : (
                        <>
                          {/* El comodín, resumido para el panel (instrucciones.comodin): las mismas reglas que juego.json. */}
                          {clave === "comodin" && <p className={CUERPO}>{ti.comodin.uso}</p>}
                          <p className={CUERPO}>
                            <span className="font-bold">{m.clasico.nombre}: </span>
                            {clave === "comodin" ? ti.comodin.clasico : textos.clasico}
                          </p>
                          <p className={CUERPO}>
                            <span className="font-bold">{m.historia.nombre}: </span>
                            {clave === "comodin" ? ti.comodin.historia : textos.historia}
                          </p>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Regla>
      </div>
      {/* Fila inferior: Nuestra historia y, a la derecha, la portada del folleto plegado. */}
      <div className="flex">
        <PanelHistoria n={5} c={c}>
          <CabeceraModo nombre={m.historia.nombre} detalle={`${m.historia.etiqueta} · ${m.historia.jugadores}`} color={COLOR_MODO.historia} />
          <p className={`${CUERPO} font-semibold`}>{m.historia.resumen}</p>
          <Titulo className="pt-[0.6mm]">{j.preparacion}</Titulo>
          <Pasos pasos={j.historia.preparacion} className="opacity-90" />
        </PanelHistoria>
        <PanelHistoria n={6} c={c}>
          <Titulo>{j.turno}</Titulo>
          <Pasos pasos={j.historia.turno} className="opacity-90" />
          <Titulo className="pt-[0.6mm]">{j.final}</Titulo>
          <Pasos pasos={j.historia.final} className="opacity-90" />
          <p className={`${CUERPO} opacity-75`}>{j.historia.dificultad}</p>
        </PanelHistoria>
        <PanelHistoria n={7} c={c}>
          <Titulo>{j.historia.completa}</Titulo>
          <p className={`${CUERPO} opacity-90`}>{j.historia.completaTexto}</p>
          {jugadores && p && (
            <div className="space-y-[0.8mm] rounded-[1.6mm] p-[2mm]" style={{ background: "rgba(245,240,230,.1)" }}>
              <p className="tipo-micro text-[5pt] tracking-[0.12em] opacity-80">{ti.vidasTitulo}</p>
              <p className={CUERPO}>
                <span className="opacity-75">{ti.vidasPersonas} </span>
                {Array.from({ length: jugadores.maximo - 1 }, (_, i) => i + 2)
                  .map((n) => `${n} → ${vidas(n)}`)
                  .join(" · ")}
              </p>
              <p className={`${CUERPO} font-semibold`}>{con(ti.vidasCompleta, { n: vidasHistoriaCompleta(p.cartas) })}</p>
            </div>
          )}
          <p className="rounded-[1.6mm] p-[2mm] text-[6.8pt] font-semibold leading-[1.3]" style={{ background: COLOR_MODO.clasico, color: c.tinta }}>
            {j.consejo}
          </p>
        </PanelHistoria>
        <Portada t={t} c={c} p={p} />
      </div>
    </div>
  );
}

/* ───────────────────────── Cara B: póster ───────────────────────── */

/** Años de ejemplo para la fila de cartas del póster: los del mazo, repartidos, o unos de muestra. */
function aniosLinea(p: Personalizacion | null): string[] {
  const extremos = (p?.anios.match(/\d{4}/g) ?? []).map(Number);
  const desde = extremos[0];
  const hasta = extremos[extremos.length - 1];
  const n = 9;
  if (desde !== undefined && hasta !== undefined && hasta - desde >= n - 1) {
    return Array.from({ length: n }, (_, i) => String(Math.round(desde + ((hasta - desde) * i) / (n - 1))));
  }
  return ["1994", "1998", "2003", "2008", "2011", "2015", "2018", "2021", "2024"];
}

export function CaraB({ t, c, p }: { t: TextosFolleto; c: ColoresFolleto; p: Personalizacion | null }) {
  const ti = t.instrucciones;
  const estilo: CSSProperties = { background: c.fondo, color: c.texto };
  return (
    <div data-panel="poster" className="relative h-[176mm] w-[252mm] overflow-hidden" style={estilo}>
      {/* Titular gigante sobre la fila superior. */}
      <div className="absolute left-[7mm] right-[7mm] top-[8mm]">
        <p className="tipo-micro text-[6pt] tracking-[0.16em] opacity-80">{t.marca}</p>
        <h2 className="tipo-titular mt-[2mm] text-[66pt] leading-[0.86]">{ti.posterTitulo}</h2>
        <p className="mt-[3mm] max-w-[110mm] text-[10pt] font-semibold leading-snug">{ti.posterTexto}</p>
      </div>
      {/* Una línea del tiempo de cartas, donde antes iba la franja de meses. */}
      <div aria-hidden="true" className="absolute left-[7mm] right-[7mm] top-[63mm] flex items-end justify-between">
        {aniosLinea(p).map((anio, i) => (
          <MiniReverso key={i} anio={anio} c={{ ...c, fondo: c.papel, texto: c.tinta }} girada={i % 2 ? 2 : -2} />
        ))}
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
