/**
 * Dibujante de la plantilla «Naipe». Un único código para la vista previa en pantalla
 * y para el archivo de impresión: lo que se ve es lo que se imprime.
 *
 * Todas las medidas de la plantilla están en milímetros sobre la carta terminada
 * (63 × 88 mm). El sangrado se dibuja fuera; sin sangrado, el lienzo es la carta cortada.
 * Los textos se miden en milímetros con una letra de referencia, así que se parten igual en
 * una miniatura que en el PDF a 300 ppp.
 */
import { PRINT } from "@config/print";
import { textoFechaCarta } from "@/domain/fechas/formato";
import { colorGlifo, obtenerPaleta, rutaIcono, superficie, type RolFuente, type Superficie, type TextoEnZona } from "@/lib/estilos";
import { ajustarTexto, partirParrafos, type Ajuste } from "./ajuste";
import type { Cara, DatosCarta, OpcionesDibujo } from "./tipos";

type Ctx = CanvasRenderingContext2D;

const W = PRINT.carta.anchoMm;
const H = PRINT.carta.altoMm;
const B = PRINT.sangradoMm;
const Z = PRINT.zonaSeguraMm;

/** Métrica vertical de Bricolage Grotesque (hhea 930 / −270; mayúsculas 660), en tamaños de letra. */
const ASC = 0.93;
const DESC = 0.27;
const MAYUSCULA = 0.66;

/** Tamaño (px) de la letra con la que se miden los textos: grande, para que el redondeo no cuente. */
const PX_MEDIDA = 100;

const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function medidasCara(op: Pick<OpcionesDibujo, "conSangrado" | "pxPorMm">): { ancho: number; alto: number } {
  const extra = op.conSangrado ? 2 * B : 0;
  return { ancho: Math.round((W + extra) * op.pxPorMm), alto: Math.round((H + extra) * op.pxPorMm) };
}

/** Proporción (ancho/alto) de la foto del anverso y del reverso, con sangrado. */
export const PROPORCION_ANVERSO = (W + 2 * B) / (H + 2 * B);
export function proporcionReverso(altoFotoMm: number): number {
  return (W + 2 * B) / (altoFotoMm + B);
}

interface Lienzo {
  ctx: Ctx;
  op: OpcionesDibujo;
  /** Posición en el lienzo de una coordenada de la carta (mm). */
  X: (mm: number) => number;
  /** Longitud en el lienzo de una medida en mm. */
  L: (mm: number) => number;
  /** Colores de las caras sin foto con esta paleta. */
  sup: Superficie;
  /** Anchos medidos en esta cara, por fuente y texto (en tamaños de letra). */
  medidas: Map<string, number>;
}

function crearLienzo(ctx: Ctx, op: OpcionesDibujo): Lienzo {
  const k = op.pxPorMm;
  const o = op.conSangrado ? B : 0;
  return { ctx, op, X: (mm) => (mm + o) * k, L: (mm) => mm * k, sup: superficie(op.paleta, op.estilo.colores), medidas: new Map() };
}

/** El mismo lienzo con otra paleta (la caja de siempre lleva la paleta por defecto del estilo). */
function conPaleta(lz: Lienzo, paletaId: string): Lienzo {
  const paleta = obtenerPaleta(lz.op.estilo, paletaId);
  const op = { ...lz.op, paleta };
  return { ...lz, op, sup: superficie(paleta, op.estilo.colores) };
}

export function dibujarCara(ctx: Ctx, cara: Cara, datos: DatosCarta, op: OpcionesDibujo): void {
  const lz = crearLienzo(ctx, op);
  const { ancho, alto } = medidasCara(op);
  const anverso = cara === "anverso";
  ctx.save();
  try {
    ctx.clearRect(0, 0, ancho, alto);
    if (op.redondear && !op.conSangrado) {
      ctx.beginPath();
      ctx.roundRect(0, 0, ancho, alto, lz.L(PRINT.carta.radioEsquinaMm));
      ctx.clip();
    }
    ctx.textBaseline = "alphabetic";
    switch (datos.tipo) {
      case "foto":
        if (anverso) anversoFoto(lz, datos);
        else reversoFoto(lz, datos);
        break;
      case "texto":
        if (anverso) anversoTexto(lz, datos);
        else reversoTexto(lz, datos);
        break;
      case "portada":
        if (anverso) anversoPortada(lz, datos);
        else reversoPortada(lz, datos);
        break;
      case "comodin":
        if (anverso) anversoComodin(lz, datos);
        else reversoComodin(lz, datos);
        break;
      case "en-blanco":
        if (anverso) anversoEnBlanco(lz, datos);
        else reversoEnBlanco(lz, datos);
        break;
      case "caja": {
        // Sin variante explícita, la caja de siempre: es la que no depende de ningún extra.
        const generica = datos.variante !== "personalizada";
        const lc = generica ? conPaleta(lz, op.estilo.paletaPorDefecto) : lz;
        if (!anverso) traseraCaja(lc, datos, generica);
        else if (generica) anversoCajaGenerica(lc);
        else anversoPortada(lc, datos);
        break;
      }
      default: {
        const sinCara: never = datos.tipo;
        throw new Error(`Tipo de carta sin cara: ${String(sinCara)}`);
      }
    }
    if (op.guias) guias(lz);
  } finally {
    ctx.restore();
  }
}

/* ───────────────────────── Piezas comunes ───────────────────────── */

function fuenteCss(op: OpcionesDibujo, rol: RolFuente, px: number): string {
  const f = op.plantilla.fuentes[rol];
  return `${f.peso} ${px.toFixed(2)}px "${f.familia}", "Bricolage Grotesque", Arial, sans-serif`;
}

function fuente(lz: Lienzo, rol: RolFuente, tamanoMm: number) {
  lz.ctx.font = fuenteCss(lz.op, rol, lz.L(tamanoMm));
}

/** Ancho de un texto en tamaños de letra (em), medido con la letra de referencia. */
function anchoEm(lz: Lienzo, rol: RolFuente, texto: string): number {
  const clave = `${rol}\u0000${texto}`;
  let w = lz.medidas.get(clave);
  if (w === undefined) {
    const { ctx } = lz;
    const antes = ctx.font;
    ctx.font = fuenteCss(lz.op, rol, PX_MEDIDA);
    w = ctx.measureText(texto).width / PX_MEDIDA;
    ctx.font = antes;
    lz.medidas.set(clave, w);
  }
  return w;
}

/**
 * Mide textos en mm a cualquier tamaño. Con espaciado, letra a letra como los dibuja
 * `textoEspaciado` (sin interletraje entre pares).
 */
function medidor(lz: Lienzo, rol: RolFuente, espaciadoEm = 0) {
  if (!espaciadoEm) return (texto: string, tamanoMm: number) => anchoEm(lz, rol, texto) * tamanoMm;
  return (texto: string, tamanoMm: number) => {
    const letras = [...texto];
    const suma = letras.reduce((s, ch) => s + anchoEm(lz, rol, ch), 0);
    return (suma + espaciadoEm * Math.max(0, letras.length - 1)) * tamanoMm;
  };
}

/** Líneas de un texto a un tamaño fijo, en un ancho (mm). La última acaba en «…» si no caben. */
function lineasFijas(lz: Lienzo, rol: RolFuente, texto: string, tamanoMm: number, anchoMm: number, maxLineas = Infinity, espaciadoEm = 0): string[] {
  const medir = medidor(lz, rol, espaciadoEm);
  return partirParrafos(texto, (t) => medir(t, tamanoMm), anchoMm, maxLineas);
}

/** Ajusta un texto a una caja (mm) con su tamaño máximo y mínimo. */
function ajustar(
  lz: Lienzo,
  rol: RolFuente,
  texto: string,
  anchoMm: number,
  altoMm: number,
  t: { tamanoMaximo: number; tamanoMinimo: number; interlineado: number; lineasMaximas: number },
): Ajuste {
  return ajustarTexto({
    texto,
    medir: medidor(lz, rol),
    anchoMax: anchoMm,
    altoMax: altoMm,
    tamanoMax: t.tamanoMaximo,
    tamanoMin: t.tamanoMinimo,
    interlineado: t.interlineado,
    lineasMax: t.lineasMaximas,
  });
}

/** Línea base de la primera línea de un bloque con un interlineado dado (como en CSS). */
function lineaBase(topMm: number, tamanoMm: number, interlineado: number): number {
  return topMm + (interlineado * tamanoMm - (ASC + DESC) * tamanoMm) / 2 + ASC * tamanoMm;
}

/** Escribe líneas a la izquierda desde una línea base (mm), con la fuente ya puesta. */
function escribirLineas(lz: Lienzo, lineas: string[], x: number, base: number, paso: number) {
  lineas.forEach((l, i) => lz.ctx.fillText(l, lz.X(x), lz.X(base + i * paso)));
}

function rellenarTodo(lz: Lienzo, color: string) {
  lz.ctx.fillStyle = color;
  lz.ctx.fillRect(lz.X(-B), lz.X(-B), lz.L(W + 2 * B), lz.L(H + 2 * B));
}

/** Rectángulo a sangre por arriba y por los lados, hasta `abajo` (mm): el sitio de la foto del reverso. */
function panelSuperior(lz: Lienzo, abajo: number, color: string) {
  lz.ctx.fillStyle = color;
  lz.ctx.fillRect(lz.X(-B), lz.X(-B), lz.L(W + 2 * B), lz.L(abajo + B));
}

function aplicarTono(lz: Lienzo): boolean {
  const filtro = lz.op.plantilla.tonosFoto[lz.op.tono]?.filtro ?? "none";
  if (filtro === "none") return true;
  if (typeof (lz.ctx as Ctx & { filter?: string }).filter === "string") {
    lz.ctx.filter = filtro;
    return true;
  }
  return false;
}

/** Tono por píxeles para navegadores sin ctx.filter (Safari antiguo). */
function tonoManual(lz: Lienzo, x: number, y: number, w: number, h: number) {
  const tono = lz.op.tono;
  if (tono === "original") return;
  const ctx = lz.ctx;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const w0 = Math.min(ctx.canvas.width - x0, Math.ceil(w));
  const h0 = Math.min(ctx.canvas.height - y0, Math.ceil(h));
  if (w0 <= 0 || h0 <= 0) return;
  const img = ctx.getImageData(x0, y0, w0, h0);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (tono === "bn") {
      const v = Math.min(255, Math.max(0, (l - 128) * 1.06 + 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    } else {
      d[i] = Math.min(255, r * 0.86 + l * 0.14 + 14);
      d[i + 1] = Math.min(255, g * 0.88 + l * 0.12 + 4);
      d[i + 2] = Math.max(0, b * 0.84 + l * 0.08 - 6);
    }
  }
  ctx.putImageData(img, x0, y0);
}

/** Ajusta un recorte a otra proporción recortando por el centro, para no deformar la foto. */
function cubrir(r: { x: number; y: number; ancho: number; alto: number }, proporcion: number) {
  const actual = r.ancho / r.alto;
  if (Math.abs(actual - proporcion) < 0.004) return r;
  if (actual > proporcion) {
    const ancho = r.alto * proporcion;
    return { ...r, x: r.x + (r.ancho - ancho) / 2, ancho };
  }
  const alto = r.ancho / proporcion;
  return { ...r, y: r.y + (r.alto - alto) / 2, alto };
}

/** Dibuja la foto recortada para cubrir un rectángulo de la carta (en mm). */
function foto(lz: Lienzo, datos: DatosCarta, cara: Cara, x: number, y: number, w: number, h: number) {
  const f = datos.foto;
  const { ctx } = lz;
  if (!f) {
    ctx.fillStyle = lz.op.estilo.colores.tinta;
    ctx.fillRect(lz.X(x), lz.X(y), lz.L(w), lz.L(h));
    return;
  }
  const r = cubrir(cara === "anverso" ? f.recorteAnverso : f.recorteReverso, w / h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(lz.X(x), lz.X(y), lz.L(w), lz.L(h));
  ctx.clip();
  const conFiltro = aplicarTono(lz);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(f.imagen, r.x * f.escala, r.y * f.escala, r.ancho * f.escala, r.alto * f.escala, lz.X(x), lz.X(y), lz.L(w), lz.L(h));
  ctx.restore();
  if (!conFiltro) tonoManual(lz, lz.X(x), lz.X(y), lz.L(w), lz.L(h));
}

/**
 * Pestaña de esquina con su valor («?» o el año) y, debajo, el hueco del icono. Sin valor
 * (reverso del comodín y de la carta en blanco), la pestaña se encoge alrededor del icono.
 */
function pestana(lz: Lienzo, valor: string, tamanoValor: number, icono: string | null | undefined, girada: boolean) {
  const { ctx, op } = lz;
  const p = op.plantilla.pestana;
  const d = p.hueco.diametro;
  const conValor = valor !== "";
  const ancho = conValor ? p.ancho : 2 * p.margenIzquierdo + d;
  const alto = conValor ? p.alto : 2 * p.margenSuperior + d;
  ctx.save();
  if (girada) {
    ctx.translate(lz.X(W / 2), lz.X(H / 2));
    ctx.rotate(Math.PI);
    ctx.translate(-lz.X(W / 2), -lz.X(H / 2));
  }
  const x0 = lz.X(-B), y0 = lz.X(-B), x1 = lz.X(ancho), y1 = lz.X(alto), r = lz.L(p.radio);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.lineTo(x1, y1 - r);
  ctx.arcTo(x1, y1, x1 - r, y1, r);
  ctx.lineTo(x0, y1);
  ctx.closePath();
  ctx.fillStyle = op.paleta.fondo;
  ctx.fill();

  let topIcono = p.margenSuperior;
  if (conValor) {
    fuente(lz, "titular", tamanoValor);
    ctx.fillStyle = op.paleta.texto;
    ctx.textAlign = "left";
    ctx.fillText(valor, lz.X(p.margenIzquierdo), lz.X(lineaBase(p.margenSuperior, tamanoValor, 0.85)));
    topIcono += 0.85 * tamanoValor + p.separacion;
  }
  hueco(lz, p.margenIzquierdo, topIcono, d, icono);
  ctx.restore();
}

function hueco(lz: Lienzo, x: number, y: number, diametro: number, icono: string | null | undefined) {
  const { ctx, op } = lz;
  const h = op.plantilla.pestana.hueco;
  const cx = lz.X(x + diametro / 2), cy = lz.X(y + diametro / 2), radio = lz.L(diametro / 2);
  if (icono && rutaIcono(op.plantilla, icono)) {
    ctx.beginPath();
    ctx.arc(cx, cy, radio, 0, Math.PI * 2);
    ctx.fillStyle = op.estilo.colores.tinta;
    ctx.fill();
    dibujarIcono(lz, icono, cx, cy, radio * h.glifo, colorGlifo(op.paleta, op.estilo.colores));
  } else if (h.visibleSinMecanica) {
    ctx.beginPath();
    ctx.arc(cx, cy, radio - lz.L(h.trazo) / 2, 0, Math.PI * 2);
    ctx.setLineDash([lz.L(0.6), lz.L(0.5)]);
    ctx.lineWidth = lz.L(h.trazo);
    ctx.strokeStyle = op.estilo.colores.tinta;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

const RUTAS = new Map<string, Path2D>();

/** Icono de la plantilla (ruta SVG en una caja de 24) centrado en (cx, cy) px, con un lado dado en px. */
function dibujarIcono(lz: Lienzo, icono: string, cx: number, cy: number, lado: number, color: string) {
  const def = rutaIcono(lz.op.plantilla, icono);
  if (!def || typeof Path2D === "undefined") return;
  let ruta = RUTAS.get(def.d);
  if (!ruta) {
    ruta = new Path2D(def.d);
    RUTAS.set(def.d, ruta);
  }
  const { ctx } = lz;
  ctx.save();
  ctx.translate(cx - lado / 2, cy - lado / 2);
  ctx.scale(lado / 24, lado / 24);
  ctx.fillStyle = color;
  ctx.fill(ruta, def.regla);
  ctx.restore();
}

/** Texto con espaciado entre letras (el canvas no siempre soporta letterSpacing). */
function textoEspaciado(lz: Lienzo, texto: string, x: number, y: number, espaciadoEm: number, tamanoMm: number) {
  const { ctx } = lz;
  let cursor = x;
  const extra = lz.L(espaciadoEm * tamanoMm);
  for (const ch of texto) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + extra;
  }
  return cursor - x - extra;
}

/** Etiqueta en mayúsculas espaciadas («¿CUÁNDO FUE?»), con la línea base en `base` (mm). */
function etiqueta(lz: Lienzo, texto: string, x: number, base: number, tamano: number, espaciado: number, centrada = false) {
  const { ctx, op } = lz;
  const mayus = texto.toLocaleUpperCase(op.idioma);
  fuente(lz, "micro", tamano);
  ctx.textAlign = "left";
  const inicio = centrada ? x - medidor(lz, "micro", espaciado)(mayus, tamano) / 2 : x;
  textoEspaciado(lz, mayus, lz.X(inicio), lz.X(base), espaciado, tamano);
}

/** Trazo corto de color sobre los textos de las caras sin foto. */
function marca(lz: Lienzo, x: number, y: number, color: string) {
  const m = lz.op.plantilla.marca;
  lz.ctx.fillStyle = color;
  lz.ctx.beginPath();
  lz.ctx.roundRect(lz.X(x), lz.X(y), lz.L(m.ancho), lz.L(m.alto), lz.L(m.alto / 2));
  lz.ctx.fill();
}

function pregunta(lz: Lienzo, color: string) {
  const { ctx, op } = lz;
  const p = op.plantilla.anverso.pregunta;
  ctx.save();
  ctx.translate(lz.X(p.izquierda), lz.X(H - p.abajo));
  ctx.rotate(-Math.PI / 2);
  fuente(lz, "micro", p.tamano);
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  textoEspaciado(lz, op.textos.pregunta.toLocaleUpperCase(op.idioma), 0, lz.L(ASC * p.tamano), p.espaciado, p.tamano);
  ctx.restore();
}

function velo(lz: Lienzo, desde: number, hasta: number, opacidad: number) {
  const { ctx, op } = lz;
  const g = ctx.createLinearGradient(lz.X(desde), 0, lz.X(hasta), 0);
  g.addColorStop(0, `rgba(${op.estilo.colores.velo}, ${opacidad})`);
  g.addColorStop(1, `rgba(${op.estilo.colores.velo}, 0)`);
  ctx.fillStyle = g;
  const x0 = Math.min(desde, hasta), x1 = Math.max(desde, hasta);
  const izq = x0 === 0 ? -B : x0;
  const der = x1 === W ? W + B : x1;
  ctx.fillRect(lz.X(izq), lz.X(-B), lz.L(der - izq), lz.L(H + 2 * B));
}

function adornos(lz: Lienzo, datos: DatosCarta) {
  const { ctx } = lz;
  for (const a of datos.adornos ?? []) {
    ctx.save();
    ctx.translate(lz.X(a.x * W), lz.X(a.y * H));
    ctx.rotate((a.giro * Math.PI) / 180);
    ctx.font = `${lz.L(a.tamano * W).toFixed(2)}px ${EMOJI}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(a.emoji, 0, 0);
    ctx.restore();
  }
}

function guias(lz: Lienzo) {
  const { ctx } = lz;
  ctx.save();
  ctx.setLineDash([lz.L(1), lz.L(0.8)]);
  ctx.lineWidth = Math.max(1, lz.L(0.2));
  ctx.strokeStyle = "#B0186C";
  ctx.strokeRect(lz.X(Z), lz.X(Z), lz.L(W - 2 * Z), lz.L(H - 2 * Z));
  if (lz.op.conSangrado) {
    ctx.setLineDash([]);
    ctx.strokeStyle = "#2E56E6";
    ctx.strokeRect(lz.X(0), lz.X(0), lz.L(W), lz.L(H));
  }
  ctx.restore();
}

/**
 * Texto grande de una cara sin foto, ajustado a su zona, con el trazo de color encima.
 * `arriba` y `abajo` son los límites de la zona en mm de la carta.
 */
function textoAjustado(
  lz: Lienzo,
  texto: string,
  t: Omit<TextoEnZona, "zona">,
  zona: { izquierda: number; derecha: number; arriba: number; abajo: number },
  colores: { texto: string; marca: string },
): { base: number; ajuste: Ajuste } {
  const { ctx, op } = lz;
  const m = op.plantilla.marca;
  const ancho = W - zona.izquierda - zona.derecha;
  const alto = zona.abajo - zona.arriba;
  const reservado = m.alto + m.separacion;
  const a = ajustar(lz, "titular", texto, ancho, alto - reservado, t);
  const s = a.tamano;
  const paso = t.interlineado * s;
  // Lo que se ve: del trazo de color a la línea base de la última línea.
  const visible = reservado + MAYUSCULA * s + (a.lineas.length - 1) * paso;
  const sobra = Math.max(0, alto - visible - DESC * s);
  const topMarca = zona.arriba + (t.alineacion === "centro" ? (alto - visible) / 2 : sobra);
  const base = topMarca + reservado + MAYUSCULA * s;
  marca(lz, zona.izquierda, topMarca, colores.marca);
  fuente(lz, "titular", s);
  ctx.fillStyle = colores.texto;
  ctx.textAlign = "left";
  escribirLineas(lz, a.lineas, zona.izquierda, base, paso);
  return { base: base + (a.lineas.length - 1) * paso, ajuste: a };
}

/** Pestaña con el año y el icono, año grande abajo a la izquierda y día y mes a la derecha. */
function bloqueFecha(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  const r = op.plantilla.reverso;
  const fecha = d.fecha ?? null;
  const textoFecha = fecha ? textoFechaCarta(fecha, op.idioma) : { anio: "····", linea: "" };
  pestana(lz, textoFecha.anio, op.plantilla.pestana.tamanoValorReverso, d.icono, false);

  const sa = r.anio.tamano;
  fuente(lz, "titular", sa);
  ctx.fillStyle = op.paleta.texto;
  ctx.textAlign = "left";
  textoEspaciado(lz, textoFecha.anio, lz.X(r.anio.izquierda), lz.X(baseAbajo(r.anio.abajo, sa)), r.anio.espaciado, sa);

  if (textoFecha.linea) {
    const sl = r.diaMes.tamano;
    fuente(lz, "titular", sl);
    ctx.textAlign = "right";
    ctx.fillText(textoFecha.linea, lz.X(W - r.diaMes.derecha), lz.X(baseAbajo(r.diaMes.abajo, sl)));
  }
}

/** Línea base de una línea apretada (interlineado 0,8) cuyo borde inferior queda a `abajo` mm del corte. */
function baseAbajo(abajo: number, tamano: number): number {
  return H - abajo - 0.8 * tamano + (0.8 * tamano - (ASC + DESC) * tamano) / 2 + ASC * tamano;
}

/* ───────────────────────── Carta de foto ───────────────────────── */

function anversoFoto(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  const a = op.plantilla.anverso;
  rellenarTodo(lz, op.estilo.colores.tinta);
  foto(lz, d, "anverso", -B, -B, W + 2 * B, H + 2 * B);
  velo(lz, 0, a.veloIzquierdo.ancho, a.veloIzquierdo.opacidad);

  const desc = d.descripcionEnAnverso ? d.descripcion?.trim() : "";
  if (desc) {
    velo(lz, W, W - a.veloDescripcion.ancho, a.veloDescripcion.opacidad);
    const s = a.descripcion.tamano;
    ctx.save();
    ctx.translate(lz.X(W - a.descripcion.derecha), lz.X(a.descripcion.arriba));
    ctx.rotate(Math.PI / 2);
    fuente(lz, "texto", s);
    ctx.fillStyle = op.estilo.colores.papel;
    ctx.textAlign = "left";
    const lineas = lineasFijas(lz, "texto", desc, s, a.descripcion.altoMaximo, 3);
    lineas.forEach((linea, i) => {
      ctx.fillText(linea, 0, lz.L(lineaBase(0, s, a.descripcion.interlineado) + i * a.descripcion.interlineado * s));
    });
    ctx.restore();
  }

  adornos(lz, d);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, d.icono, false);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, d.icono, true);
  pregunta(lz, op.estilo.colores.papel);
}

function reversoFoto(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  const r = op.plantilla.reverso;
  rellenarTodo(lz, op.paleta.fondo);
  foto(lz, d, "reverso", -B, -B, W + 2 * B, r.altoFoto + B);

  const desc = d.descripcion?.trim();
  if (desc) {
    const s = r.descripcion.tamano;
    fuente(lz, "texto", s);
    ctx.fillStyle = op.paleta.texto;
    ctx.textAlign = "left";
    const lineas = lineasFijas(lz, "texto", desc, s, W - 2 * r.descripcion.lateral, r.descripcion.lineasMaximas);
    escribirLineas(lz, lineas, r.descripcion.lateral, lineaBase(r.descripcion.arriba, s, r.descripcion.interlineado), r.descripcion.interlineado * s);
  }
  bloqueFecha(lz, d);
}

/* ───────────────────────── Carta de texto (sin foto) ───────────────────────── */

function anversoTexto(lz: Lienzo, d: DatosCarta) {
  const { op, sup } = lz;
  const t = op.plantilla.texto.anverso;
  rellenarTodo(lz, sup.fondo);
  textoAjustado(lz, d.texto ?? "", t, { ...t.zona, abajo: H - t.zona.abajo }, { texto: sup.texto, marca: sup.acento });
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, d.icono, false);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, d.icono, true);
  pregunta(lz, sup.texto);
}

function reversoTexto(lz: Lienzo, d: DatosCarta) {
  const { op, sup } = lz;
  const t = op.plantilla.texto.reverso;
  const alto = op.plantilla.reverso.altoFoto;
  rellenarTodo(lz, op.paleta.fondo);
  panelSuperior(lz, alto, sup.fondo);
  textoAjustado(lz, d.texto ?? "", t, { ...t.zona, abajo: alto - t.zona.abajo }, { texto: sup.texto, marca: sup.acento });
  bloqueFecha(lz, d);
}

/* ───────────────────────── Portada y caja ───────────────────────── */

function anversoPortada(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  const g = op.plantilla.portada;
  rellenarTodo(lz, op.estilo.colores.tinta);
  // La foto de la portada es apaisada: parte del recorte del reverso, que es el más parecido.
  foto(lz, d, "reverso", -B, -B, W + 2 * B, H - g.banda + B);
  ctx.fillStyle = op.paleta.fondo;
  ctx.fillRect(lz.X(-B), lz.X(H - g.banda), lz.L(W + 2 * B), lz.L(g.banda + B));

  const titulo = (d.titulo ?? "").trim();
  if (titulo) {
    const a = ajustar(lz, "titular", titulo, W - 2 * g.margen, g.titulo.altoMaximo, g.titulo);
    fuente(lz, "titular", a.tamano);
    ctx.fillStyle = op.paleta.texto;
    ctx.textAlign = "left";
    const paso = g.titulo.interlineado * a.tamano;
    escribirLineas(lz, a.lineas, g.margen, lineaBase(H - g.banda + g.titulo.arriba, a.tamano, g.titulo.interlineado), paso);
  }

  if (d.subtitulo) {
    ctx.fillStyle = op.paleta.texto;
    etiqueta(lz, d.subtitulo, g.margen, H - g.subtitulo.abajo, g.subtitulo.tamano, g.subtitulo.espaciado);
  }
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, null, false);
}

function reversoPortada(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  const g = op.plantilla.portada;
  const ded = g.dedicatoria;
  rellenarTodo(lz, op.paleta.fondo);
  // Tarjeta de papel con la dedicatoria.
  ctx.fillStyle = op.estilo.colores.papel;
  ctx.beginPath();
  ctx.roundRect(lz.X(g.margen), lz.X(ded.arriba), lz.L(W - 2 * g.margen), lz.L(ded.alto), lz.L(ded.radio));
  ctx.fill();
  const texto = (d.dedicatoria ?? "").trim() || op.textos.dedicatoriaPorDefecto;
  const a = ajustar(lz, "texto", texto, W - 2 * (g.margen + ded.relleno), ded.alto - 2 * ded.relleno, ded);
  fuente(lz, "texto", a.tamano);
  ctx.fillStyle = op.estilo.colores.tinta;
  ctx.textAlign = "left";
  escribirLineas(lz, a.lineas, g.margen + ded.relleno, lineaBase(ded.arriba + ded.relleno, a.tamano, ded.interlineado), ded.interlineado * a.tamano);

  ctx.fillStyle = op.paleta.texto;
  const j = g.jugar;
  const lineasJuego = lineasFijas(lz, "micro", op.textos.portadaReverso.toLocaleUpperCase(op.idioma), j.tamano, W - 2 * g.margen, j.lineasMaximas, j.espaciado);
  lineasJuego.forEach((l, i) => etiqueta(lz, l, g.margen, lineaBase(j.arriba, j.tamano, j.interlineado) + i * j.interlineado * j.tamano, j.tamano, j.espaciado));

  if (d.subtitulo) {
    fuente(lz, "titular", g.anios.tamano);
    ctx.textAlign = "left";
    ctx.fillText(d.subtitulo, lz.X(g.margen), lz.X(H - g.anios.abajo));
  }
}

/** Cara de la caja de siempre: la marca como el texto de una carta sin foto, con la paleta del estilo. */
function anversoCajaGenerica(lz: Lienzo) {
  const { ctx, op, sup } = lz;
  const g = op.plantilla.caja.generica;
  const n = g.nombre;
  rellenarTodo(lz, sup.fondo);
  // El lema va debajo del nombre: se reserva su sitio y el nombre se ajusta en lo que queda.
  const lemaLineas = lineasFijas(lz, "texto", op.textos.cajaLema, g.lema.tamano, W - n.zona.izquierda - n.zona.derecha, g.lema.lineasMaximas);
  const altoLema = g.lema.separacion + lemaLineas.length * g.lema.interlineado * g.lema.tamano;
  const zona = { ...n.zona, abajo: H - n.zona.abajo - altoLema };
  const { base } = textoAjustado(lz, op.textos.marca, { ...n, alineacion: "centro" }, zona, { texto: sup.texto, marca: sup.acento });
  fuente(lz, "texto", g.lema.tamano);
  ctx.fillStyle = sup.texto;
  ctx.textAlign = "left";
  const paso = g.lema.interlineado * g.lema.tamano;
  escribirLineas(lz, lemaLineas, n.zona.izquierda, base + g.lema.separacion + MAYUSCULA * g.lema.tamano, paso);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, null, false);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, null, true);
  pregunta(lz, sup.texto);
}

/** Trasera de la caja: marca, la pregunta del juego y cómo se juega. La personalizada, con sus años. */
function traseraCaja(lz: Lienzo, d: DatosCarta, generica: boolean) {
  const { ctx, op } = lz;
  const g = op.plantilla.caja;
  const margen = op.plantilla.portada.margen;
  rellenarTodo(lz, op.paleta.fondo);
  ctx.fillStyle = op.paleta.texto;
  etiqueta(lz, op.textos.marca, margen, lineaBase(g.marca.arriba, g.marca.tamano, 1), g.marca.tamano, g.marca.espaciado);

  fuente(lz, "titular", g.pregunta.tamano);
  ctx.textAlign = "left";
  const lineasPregunta = lineasFijas(lz, "titular", op.textos.pregunta, g.pregunta.tamano, W - 2 * margen, g.pregunta.lineasMaximas);
  const pasoPregunta = g.pregunta.interlineado * g.pregunta.tamano;
  escribirLineas(lz, lineasPregunta, margen, lineaBase(g.pregunta.arriba, g.pregunta.tamano, g.pregunta.interlineado), pasoPregunta);

  const m = op.plantilla.marca;
  const capTexto = lineaBase(g.texto.arriba, g.texto.tamano, g.texto.interlineado) - MAYUSCULA * g.texto.tamano;
  marca(lz, margen, capTexto - m.separacion - m.alto, op.paleta.texto);
  fuente(lz, "texto", g.texto.tamano);
  ctx.fillStyle = op.paleta.texto;
  const lineas = lineasFijas(lz, "texto", (d.texto ?? "").trim() || op.textos.cajaTexto, g.texto.tamano, W - 2 * margen, g.texto.lineasMaximas);
  escribirLineas(lz, lineas, margen, lineaBase(g.texto.arriba, g.texto.tamano, g.texto.interlineado), g.texto.interlineado * g.texto.tamano);

  if (!generica && d.subtitulo) {
    const a = op.plantilla.portada.anios;
    fuente(lz, "titular", a.tamano);
    ctx.fillText(d.subtitulo, lz.X(margen), lz.X(H - a.abajo));
  }
}

/* ───────────────────────── Comodín y carta en blanco ───────────────────────── */

function anversoComodin(lz: Lienzo, d: DatosCarta) {
  const { ctx, op, sup } = lz;
  const g = op.plantilla.comodin.anverso;
  rellenarTodo(lz, sup.fondo);
  if (d.icono) dibujarIcono(lz, d.icono, lz.X(W / 2), lz.X(g.centroArte), lz.L(g.tamanoArte), sup.acento);
  fuente(lz, "titular", g.titulo.tamano);
  ctx.fillStyle = sup.texto;
  ctx.textAlign = "center";
  ctx.fillText(op.textos.comodin.toLocaleUpperCase(op.idioma), lz.X(W / 2), lz.X(H - g.titulo.abajo));
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, d.icono, false);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, d.icono, true);
}

function reversoComodin(lz: Lienzo, d: DatosCarta) {
  const { ctx, op, sup } = lz;
  const g = op.plantilla.comodin.reverso;
  const margen = Z;
  rellenarTodo(lz, op.paleta.fondo);
  panelSuperior(lz, op.plantilla.reverso.altoFoto, sup.fondo);
  if (d.icono) dibujarIcono(lz, d.icono, lz.X(W / 2), lz.X(g.centroArte), lz.L(g.tamanoArte), sup.acento);
  pestana(lz, "", op.plantilla.pestana.tamanoValorReverso, d.icono, false);

  fuente(lz, "titular", g.titulo.tamano);
  ctx.fillStyle = op.paleta.texto;
  ctx.textAlign = "left";
  ctx.fillText(op.textos.comodin, lz.X(margen), lz.X(lineaBase(g.titulo.arriba, g.titulo.tamano, 1)));

  const r = g.regla;
  const a = ajustar(lz, "texto", op.textos.comodinRegla, W - 2 * margen, H - r.abajo - r.arriba, r);
  fuente(lz, "texto", a.tamano);
  escribirLineas(lz, a.lineas, margen, lineaBase(r.arriba, a.tamano, r.interlineado), r.interlineado * a.tamano);
}

function anversoEnBlanco(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  const g = op.plantilla.enBlanco.anverso;
  const tinta = op.estilo.colores.tinta;
  rellenarTodo(lz, op.estilo.colores.papel);
  const z = g.zona;
  const ancho = W - z.izquierda - z.derecha;
  const alto = H - z.arriba - z.abajo;
  ctx.save();
  ctx.setLineDash(z.guion.map((v) => lz.L(v)));
  ctx.lineWidth = lz.L(z.trazo);
  ctx.strokeStyle = tinta;
  ctx.beginPath();
  ctx.roundRect(lz.X(z.izquierda), lz.X(z.arriba), lz.L(ancho), lz.L(alto), lz.L(z.radio));
  ctx.stroke();
  ctx.restore();

  const av = g.aviso;
  const lineas = lineasFijas(lz, "micro", op.textos.enBlancoFoto.toLocaleUpperCase(op.idioma), av.tamano, ancho - 2 * Z, 2, av.espaciado);
  const paso = av.interlineado * av.tamano;
  const primera = z.arriba + alto / 2 - ((lineas.length - 1) * paso) / 2 + (MAYUSCULA * av.tamano) / 2;
  ctx.fillStyle = tinta;
  lineas.forEach((l, i) => etiqueta(lz, l, W / 2, primera + i * paso, av.tamano, av.espaciado, true));

  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, d.icono, false);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, d.icono, true);
  pregunta(lz, tinta);
}

function reversoEnBlanco(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  const g = op.plantilla.enBlanco.reverso;
  const { tinta, papel } = op.estilo.colores;
  const margen = Z;
  rellenarTodo(lz, op.paleta.fondo);
  panelSuperior(lz, op.plantilla.reverso.altoFoto, papel);
  pestana(lz, "", op.plantilla.pestana.tamanoValorReverso, d.icono, false);

  // Frase: etiqueta y líneas para escribir, donde iría la foto.
  const f = g.frase;
  ctx.fillStyle = tinta;
  etiqueta(lz, op.textos.enBlancoFrase, margen, lineaBase(f.arriba, f.tamano, 1), f.tamano, f.espaciado);
  ctx.strokeStyle = tinta;
  ctx.lineWidth = lz.L(f.trazo);
  for (const y of f.lineas) {
    ctx.beginPath();
    ctx.moveTo(lz.X(margen), lz.X(y));
    ctx.lineTo(lz.X(W - margen), lz.X(y));
    ctx.stroke();
  }

  // Año y día y mes: casillas de papel donde la carta de foto pone su fecha.
  const c = g.casillas;
  const util = W - 2 * margen - c.separacion;
  const anchoAnio = util * c.proporcionAnio;
  const casillas = [
    { x: margen, ancho: anchoAnio, texto: op.textos.enBlancoAnio },
    { x: margen + anchoAnio + c.separacion, ancho: util - anchoAnio, texto: op.textos.enBlancoDiaMes },
  ];
  for (const k of casillas) {
    ctx.fillStyle = papel;
    ctx.beginPath();
    ctx.roundRect(lz.X(k.x), lz.X(c.arriba), lz.L(k.ancho), lz.L(H - c.abajo - c.arriba), lz.L(c.radio));
    ctx.fill();
    ctx.fillStyle = tinta;
    etiqueta(lz, k.texto, k.x + c.etiqueta.margen, c.arriba + c.etiqueta.margen + MAYUSCULA * c.etiqueta.tamano, c.etiqueta.tamano, c.etiqueta.espaciado);
  }
}
