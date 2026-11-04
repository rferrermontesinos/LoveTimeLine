/**
 * Dibujante de la plantilla «Naipe». Un único código para la vista previa en pantalla
 * y para el archivo de impresión: lo que se ve es lo que se imprime.
 *
 * Todas las medidas de la plantilla están en milímetros sobre la carta terminada
 * (63 × 88 mm). El sangrado se dibuja fuera; sin sangrado, el lienzo es la carta cortada.
 */
import { PRINT } from "@config/print";
import { textoFechaCarta } from "@/domain/fechas/formato";
import type { Cara, DatosCarta, OpcionesDibujo } from "./tipos";

type Ctx = CanvasRenderingContext2D;

const W = PRINT.carta.anchoMm;
const H = PRINT.carta.altoMm;
const B = PRINT.sangradoMm;

/** Proporciones de la métrica vertical de Bricolage Grotesque (hhea: 930 / −270). */
const ASC = 0.93;
const DESC = 0.27;

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
}

function crearLienzo(ctx: Ctx, op: OpcionesDibujo): Lienzo {
  const k = op.pxPorMm;
  const o = op.conSangrado ? B : 0;
  return { ctx, op, X: (mm) => (mm + o) * k, L: (mm) => mm * k };
}

export function dibujarCara(ctx: Ctx, cara: Cara, datos: DatosCarta, op: OpcionesDibujo): void {
  const lz = crearLienzo(ctx, op);
  const { ancho, alto } = medidasCara(op);
  ctx.save();
  ctx.clearRect(0, 0, ancho, alto);
  if (op.redondear && !op.conSangrado) {
    ctx.beginPath();
    ctx.roundRect(0, 0, ancho, alto, lz.L(PRINT.carta.radioEsquinaMm));
    ctx.clip();
  }
  ctx.textBaseline = "alphabetic";
  switch (datos.tipo) {
    case "foto":
      if (cara === "anverso") anversoFoto(lz, datos);
      else reversoFoto(lz, datos);
      break;
    case "portada":
      if (cara === "anverso") anversoPortada(lz, datos);
      else reversoPortada(lz, datos);
      break;
    case "comodin":
      if (cara === "anverso") anversoComodin(lz);
      else reversoComodin(lz);
      break;
    case "en-blanco":
      if (cara === "anverso") anversoEnBlanco(lz);
      else reversoEnBlanco(lz);
      break;
    case "reto":
      if (cara === "anverso") anversoReto(lz);
      else reversoReto(lz, datos);
      break;
    case "caja":
      if (cara === "anverso") anversoPortada(lz, datos);
      else traseraCaja(lz, datos);
      break;
  }
  if (op.guias) guias(lz);
  ctx.restore();
}

/* ───────────────────────── Piezas comunes ───────────────────────── */

function fuente(lz: Lienzo, rol: keyof OpcionesDibujo["plantilla"]["fuentes"], tamanoMm: number) {
  const f = lz.op.plantilla.fuentes[rol];
  lz.ctx.font = `${f.peso} ${lz.L(tamanoMm).toFixed(2)}px "${f.familia}", "Bricolage Grotesque", Arial, sans-serif`;
}

/** Línea base de la primera línea de un bloque con un interlineado dado (como en CSS). */
function lineaBase(topMm: number, tamanoMm: number, interlineado: number): number {
  return topMm + (interlineado * tamanoMm - (ASC + DESC) * tamanoMm) / 2 + ASC * tamanoMm;
}

function rellenarTodo(lz: Lienzo, color: string) {
  lz.ctx.fillStyle = color;
  lz.ctx.fillRect(lz.X(-B), lz.X(-B), lz.L(W + 2 * B), lz.L(H + 2 * B));
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

/** Pestaña de esquina con su valor y el hueco reservado para mecánicas. */
function pestana(lz: Lienzo, valor: string, tamanoValor: number, icono: string | null | undefined, girada: boolean) {
  const { ctx, op } = lz;
  const p = op.plantilla.pestana;
  ctx.save();
  if (girada) {
    ctx.translate(lz.X(W / 2), lz.X(H / 2));
    ctx.rotate(Math.PI);
    ctx.translate(-lz.X(W / 2), -lz.X(H / 2));
  }
  const x0 = lz.X(-B), y0 = lz.X(-B), x1 = lz.X(p.ancho), y1 = lz.X(p.alto), r = lz.L(p.radio);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.lineTo(x1, y1 - r);
  ctx.arcTo(x1, y1, x1 - r, y1, r);
  ctx.lineTo(x0, y1);
  ctx.closePath();
  ctx.fillStyle = op.tinta.fondo;
  ctx.fill();

  fuente(lz, "titular", tamanoValor);
  ctx.fillStyle = op.tinta.texto;
  ctx.textAlign = "left";
  ctx.fillText(valor, lz.X(p.margenIzquierdo), lz.X(lineaBase(p.margenSuperior, tamanoValor, 0.85)));

  const topIcono = p.margenSuperior + 0.85 * tamanoValor + p.separacion;
  hueco(lz, p.margenIzquierdo, topIcono, p.hueco.diametro, icono);
  ctx.restore();
}

function hueco(lz: Lienzo, x: number, y: number, diametro: number, icono: string | null | undefined) {
  const { ctx, op } = lz;
  const cx = lz.X(x + diametro / 2), cy = lz.X(y + diametro / 2), radio = lz.L(diametro / 2);
  if (icono) {
    ctx.beginPath();
    ctx.arc(cx, cy, radio, 0, Math.PI * 2);
    ctx.fillStyle = op.estilo.colores.tinta;
    ctx.fill();
    dibujarIcono(lz, icono, cx, cy, radio * 1.3, op.tinta.fondo === op.estilo.colores.tinta ? op.estilo.colores.papel : op.tinta.fondo);
  } else if (op.plantilla.pestana.hueco.visibleSinMecanica) {
    ctx.beginPath();
    ctx.arc(cx, cy, radio - lz.L(op.plantilla.pestana.hueco.trazo) / 2, 0, Math.PI * 2);
    ctx.setLineDash([lz.L(0.6), lz.L(0.5)]);
    ctx.lineWidth = lz.L(op.plantilla.pestana.hueco.trazo);
    ctx.strokeStyle = op.estilo.colores.tinta;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Icono de la plantilla (ruta SVG en una caja de 24) centrado en (cx, cy) con un lado dado en px. */
function dibujarIcono(lz: Lienzo, icono: string, cx: number, cy: number, lado: number, color: string) {
  const ruta = (lz.op.plantilla.iconos as Record<string, string>)[icono];
  if (!ruta || typeof Path2D === "undefined") return;
  const { ctx } = lz;
  ctx.save();
  ctx.translate(cx - lado / 2, cy - lado / 2);
  ctx.scale(lado / 24, lado / 24);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(ruta));
  ctx.restore();
}

/** Texto en mayúsculas con espaciado (el canvas no siempre soporta letterSpacing). */
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

function anchoEspaciado(lz: Lienzo, texto: string, espaciadoEm: number, tamanoMm: number) {
  let w = 0;
  const extra = lz.L(espaciadoEm * tamanoMm);
  for (const ch of texto) w += lz.ctx.measureText(ch).width + extra;
  return w - extra;
}

/** Parte un texto en líneas que caben en un ancho (px). Añade «…» si pasa del máximo. */
export function partirLineas(ctx: Ctx, texto: string, anchoMax: number, maxLineas = Infinity): string[] {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  const cabe = (t: string) => ctx.measureText(t).width <= anchoMax;
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (cabe(prueba)) {
      actual = prueba;
      continue;
    }
    if (actual) lineas.push(actual);
    if (cabe(palabra)) {
      actual = palabra;
    } else {
      // Palabra más larga que la línea: se corta por caracteres.
      let trozo = "";
      for (const ch of palabra) {
        if (cabe(trozo + ch)) trozo += ch;
        else {
          lineas.push(trozo);
          trozo = ch;
        }
      }
      actual = trozo;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const cortadas = lineas.slice(0, maxLineas);
    let ultima = cortadas[maxLineas - 1]!;
    while (ultima.length > 0 && !cabe(`${ultima}…`)) ultima = ultima.slice(0, -1).trimEnd();
    cortadas[maxLineas - 1] = `${ultima}…`;
    return cortadas;
  }
  return lineas;
}

function regla(lz: Lienzo, top: number, mes: number | null, color: string, todas: boolean, vacia = false) {
  const { ctx, op } = lz;
  const g = op.plantilla.reverso.regla;
  ctx.fillStyle = color;
  ctx.fillRect(lz.X(-B), lz.X(top), lz.L(W + 2 * B), lz.L(g.alto));
  const anchoUtil = W - 2 * g.margenLateral;
  const celda = (anchoUtil - 11 * g.separacion) / 12;
  for (let i = 0; i < 12; i++) {
    const x = g.margenLateral + i * (celda + g.separacion);
    ctx.beginPath();
    ctx.roundRect(lz.X(x), lz.X(top + g.arribaCelda), lz.L(celda), lz.L(g.altoCelda), lz.L(g.radio));
    if (vacia) {
      ctx.lineWidth = lz.L(0.18);
      ctx.strokeStyle = op.estilo.colores.tinta;
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = todas || i + 1 === mes ? op.estilo.colores.tinta : op.estilo.colores.celdaInactiva;
    ctx.fill();
  }
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
  const z = PRINT.zonaSeguraMm;
  ctx.save();
  ctx.setLineDash([lz.L(1), lz.L(0.8)]);
  ctx.lineWidth = Math.max(1, lz.L(0.2));
  ctx.strokeStyle = "#B0186C";
  ctx.strokeRect(lz.X(z), lz.X(z), lz.L(W - 2 * z), lz.L(H - 2 * z));
  if (lz.op.conSangrado) {
    ctx.setLineDash([]);
    ctx.strokeStyle = "#2E56E6";
    ctx.strokeRect(lz.X(0), lz.X(0), lz.L(W), lz.L(H));
  }
  ctx.restore();
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
    fuente(lz, "texto", s);
    ctx.save();
    ctx.translate(lz.X(W - a.descripcion.derecha), lz.X(a.descripcion.arriba));
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = op.estilo.colores.papel;
    ctx.textAlign = "left";
    const lineas = partirLineas(ctx, desc, lz.L(a.descripcion.altoMaximo), 3);
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
  rellenarTodo(lz, op.tinta.fondo);
  foto(lz, d, "reverso", -B, -B, W + 2 * B, r.altoFoto + B);

  const fecha = d.fecha ?? null;
  regla(lz, r.altoFoto, fecha?.mes ?? null, op.tinta.franja, !!fecha && fecha.mes === undefined, !fecha);
  const textoFecha = fecha ? textoFechaCarta(fecha, op.idioma) : { anio: "····", linea: "" };
  pestana(lz, textoFecha.anio, op.plantilla.pestana.tamanoValorReverso, d.icono, false);

  const desc = d.descripcion?.trim();
  if (desc) {
    const s = r.descripcion.tamano;
    fuente(lz, "texto", s);
    ctx.fillStyle = op.tinta.texto;
    ctx.textAlign = "left";
    const lineas = partirLineas(ctx, desc, lz.L(W - 2 * r.descripcion.lateral), r.descripcion.lineasMaximas);
    lineas.forEach((linea, i) => {
      ctx.fillText(linea, lz.X(r.descripcion.lateral), lz.X(lineaBase(r.descripcion.arriba, s, r.descripcion.interlineado) + i * r.descripcion.interlineado * s));
    });
  }

  // Año grande abajo a la izquierda y día+mes a la derecha, en una línea.
  const sa = r.anio.tamano;
  fuente(lz, "titular", sa);
  ctx.fillStyle = op.tinta.texto;
  ctx.textAlign = "left";
  const baseAnio = H - r.anio.abajo - 0.8 * sa + (0.8 * sa - (ASC + DESC) * sa) / 2 + ASC * sa;
  textoEspaciado(lz, textoFecha.anio, lz.X(r.anio.izquierda), lz.X(baseAnio), r.anio.espaciado, sa);

  if (textoFecha.linea) {
    const sl = r.diaMes.tamano;
    fuente(lz, "titular", sl);
    ctx.textAlign = "right";
    const baseLinea = H - r.diaMes.abajo - 0.8 * sl + (0.8 * sl - (ASC + DESC) * sl) / 2 + ASC * sl;
    ctx.fillText(textoFecha.linea, lz.X(W - r.diaMes.derecha), lz.X(baseLinea));
  }
}

/* ───────────────────────── Portada y caja ───────────────────────── */

function anversoPortada(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  rellenarTodo(lz, op.estilo.colores.tinta);
  const banda = 30;
  // La foto de la portada es apaisada: parte del recorte del reverso, que es el más parecido.
  foto(lz, d, "reverso", -B, -B, W + 2 * B, H - banda + B);
  ctx.fillStyle = op.tinta.fondo;
  ctx.fillRect(lz.X(-B), lz.X(H - banda), lz.L(W + 2 * B), lz.L(banda + B));
  regla(lz, H - banda, null, op.tinta.franja, true);

  const titulo = (d.titulo ?? "").trim();
  fuente(lz, "titular", 9.5);
  ctx.fillStyle = op.tinta.texto;
  ctx.textAlign = "left";
  const lineas = partirLineas(ctx, titulo, lz.L(W - 8), 2);
  const tam = lineas.length > 1 ? 8 : 9.5;
  fuente(lz, "titular", tam);
  const lineasFinal = partirLineas(ctx, titulo, lz.L(W - 8), 2);
  lineasFinal.forEach((l, i) => ctx.fillText(l, lz.X(4), lz.X(H - banda + 5 + lineaBase(0, tam, 0.9) + i * 0.9 * tam)));

  if (d.subtitulo) {
    fuente(lz, "micro", 2.2);
    textoEspaciado(lz, d.subtitulo.toLocaleUpperCase(op.idioma), lz.X(4), lz.X(H - 4.6), 0.14, 2.2);
  }
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, null, false);
}

function reversoPortada(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  rellenarTodo(lz, op.tinta.fondo);
  // Tarjeta de papel con la dedicatoria.
  ctx.fillStyle = op.estilo.colores.papel;
  ctx.beginPath();
  ctx.roundRect(lz.X(4), lz.X(6), lz.L(W - 8), lz.L(50), lz.L(2.5));
  ctx.fill();
  const s = 3.2;
  fuente(lz, "texto", s);
  ctx.fillStyle = op.estilo.colores.tinta;
  ctx.textAlign = "left";
  const lineas = partirLineas(ctx, (d.dedicatoria ?? "").trim() || op.textos.dedicatoriaPorDefecto, lz.L(W - 16), 8);
  lineas.forEach((l, i) => ctx.fillText(l, lz.X(8), lz.X(lineaBase(10, s, 1.35) + i * 1.35 * s)));

  regla(lz, 60, null, op.tinta.franja, true);
  fuente(lz, "micro", 2);
  ctx.fillStyle = op.tinta.texto;
  const lineasJuego = partirLineas(ctx, op.textos.portadaReverso.toLocaleUpperCase(op.idioma), lz.L(W - 8), 2);
  lineasJuego.forEach((l, i) => textoEspaciado(lz, l, lz.X(4), lz.X(67.5 + i * 2.8), 0.1, 2));

  if (d.subtitulo) {
    const sa = 12;
    fuente(lz, "titular", sa);
    ctx.textAlign = "left";
    ctx.fillText(d.subtitulo, lz.X(4), lz.X(H - 4.8));
  }
}

function traseraCaja(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  rellenarTodo(lz, op.tinta.fondo);
  regla(lz, 12, null, op.tinta.franja, true);
  fuente(lz, "micro", 2.4);
  ctx.fillStyle = op.tinta.texto;
  textoEspaciado(lz, op.textos.marca.toLocaleUpperCase(op.idioma), lz.X(4), lz.X(8), 0.14, 2.4);
  fuente(lz, "titular", 9);
  ctx.textAlign = "left";
  partirLineas(ctx, op.textos.pregunta, lz.L(W - 8), 2).forEach((l, i) => ctx.fillText(l, lz.X(4), lz.X(26 + i * 8.5)));
  fuente(lz, "texto", 3);
  partirLineas(ctx, d.texto || op.textos.cajaTexto, lz.L(W - 8), 9).forEach((l, i) => ctx.fillText(l, lz.X(4), lz.X(44 + i * 4)));
  if (d.subtitulo) {
    fuente(lz, "titular", 12);
    ctx.fillText(d.subtitulo, lz.X(4), lz.X(H - 4.8));
  }
}

/* ───────────────────────── Comodín, en blanco y reto ───────────────────────── */

function anversoComodin(lz: Lienzo) {
  const { ctx, op } = lz;
  rellenarTodo(lz, op.estilo.colores.tinta);
  dibujarIcono(lz, "estrella", lz.X(W / 2), lz.X(H / 2 - 6), lz.L(26), op.tinta.fondo);
  fuente(lz, "titular", 9);
  ctx.fillStyle = op.tinta.fondo;
  ctx.textAlign = "center";
  ctx.fillText(op.textos.comodin.toLocaleUpperCase(op.idioma), lz.X(W / 2), lz.X(H / 2 + 16));
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, null, false);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, null, true);
}

function reversoComodin(lz: Lienzo) {
  const { ctx, op } = lz;
  rellenarTodo(lz, op.tinta.fondo);
  ctx.fillStyle = op.estilo.colores.tinta;
  ctx.fillRect(lz.X(-B), lz.X(-B), lz.L(W + 2 * B), lz.L(55 + B));
  dibujarIcono(lz, "estrella", lz.X(W / 2), lz.X(28), lz.L(30), op.tinta.fondo);
  regla(lz, 55, null, op.tinta.franja, false, true);
  pestana(lz, "★", op.plantilla.pestana.tamanoValorReverso, null, false);
  fuente(lz, "titular", 7);
  ctx.fillStyle = op.tinta.texto;
  ctx.textAlign = "left";
  ctx.fillText(op.textos.comodin, lz.X(4), lz.X(66));
  fuente(lz, "texto", 2.6);
  partirLineas(ctx, op.textos.comodinRegla, lz.L(W - 8), 5).forEach((l, i) => ctx.fillText(l, lz.X(4), lz.X(71 + i * 3.3)));
}

function anversoEnBlanco(lz: Lienzo) {
  const { ctx, op } = lz;
  rellenarTodo(lz, op.estilo.colores.papel);
  ctx.save();
  ctx.setLineDash([lz.L(1.2), lz.L(1)]);
  ctx.lineWidth = lz.L(0.3);
  ctx.strokeStyle = op.estilo.colores.tinta;
  ctx.strokeRect(lz.X(8), lz.X(24), lz.L(W - 16), lz.L(H - 44));
  ctx.restore();
  fuente(lz, "micro", 2.2);
  ctx.fillStyle = op.estilo.colores.tinta;
  const texto = op.textos.enBlancoFoto.toLocaleUpperCase(op.idioma);
  const w = anchoEspaciado(lz, texto, 0.14, 2.2);
  textoEspaciado(lz, texto, lz.X(W / 2) - w / 2, lz.X(H / 2 + 1), 0.14, 2.2);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, null, false);
  pestana(lz, "?", op.plantilla.pestana.tamanoValorAnverso, null, true);
  pregunta(lz, op.estilo.colores.tinta);
}

function reversoEnBlanco(lz: Lienzo) {
  const { ctx, op } = lz;
  rellenarTodo(lz, op.tinta.fondo);
  ctx.fillStyle = op.estilo.colores.papel;
  ctx.fillRect(lz.X(-B), lz.X(-B), lz.L(W + 2 * B), lz.L(55 + B));
  regla(lz, 55, null, op.tinta.franja, false, true);
  pestana(lz, "", op.plantilla.pestana.tamanoValorReverso, null, false);
  ctx.fillStyle = op.tinta.texto;
  ctx.strokeStyle = op.tinta.texto;
  ctx.lineWidth = lz.L(0.2);
  fuente(lz, "micro", 2);
  textoEspaciado(lz, op.textos.enBlancoFrase.toLocaleUpperCase(op.idioma), lz.X(4), lz.X(62.5), 0.14, 2);
  for (const y of [68.5, 74]) {
    ctx.beginPath();
    ctx.moveTo(lz.X(4), lz.X(y));
    ctx.lineTo(lz.X(W - 4), lz.X(y));
    ctx.stroke();
  }
  textoEspaciado(lz, op.textos.enBlancoFecha.toLocaleUpperCase(op.idioma), lz.X(4), lz.X(79.5), 0.14, 2);
  ctx.beginPath();
  ctx.moveTo(lz.X(4), lz.X(H - 4));
  ctx.lineTo(lz.X(W - 4), lz.X(H - 4));
  ctx.stroke();
}

function anversoReto(lz: Lienzo) {
  const { ctx, op } = lz;
  rellenarTodo(lz, op.tinta.franja);
  fuente(lz, "titular", 16);
  ctx.fillStyle = op.estilo.colores.tinta;
  ctx.textAlign = "center";
  ctx.fillText(op.textos.reto.toLocaleUpperCase(op.idioma), lz.X(W / 2), lz.X(H / 2 + 5));
  pestana(lz, "!", op.plantilla.pestana.tamanoValorAnverso, null, false);
  pestana(lz, "!", op.plantilla.pestana.tamanoValorAnverso, null, true);
}

function reversoReto(lz: Lienzo, d: DatosCarta) {
  const { ctx, op } = lz;
  rellenarTodo(lz, op.tinta.fondo);
  pestana(lz, "!", op.plantilla.pestana.tamanoValorReverso, null, false);
  fuente(lz, "titular", 7);
  ctx.fillStyle = op.tinta.texto;
  ctx.textAlign = "left";
  ctx.fillText(op.textos.reto, lz.X(4), lz.X(30));
  const s = 4;
  fuente(lz, "texto", s);
  partirLineas(ctx, d.texto ?? "", lz.L(W - 8), 8).forEach((l, i) => ctx.fillText(l, lz.X(4), lz.X(38 + i * 1.3 * s)));
  regla(lz, H - 12, null, op.tinta.franja, false, true);
}
