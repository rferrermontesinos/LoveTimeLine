import { describe, expect, it } from "vitest";
import { crearServicio } from "@datos/functions/colaboracion/servicio";
import { ErrorAportacion, medidasJpeg } from "@/domain/colaboracion/aportacion";
import { aBase64url, clavePublicaCruda, crearLlavesDueno, ErrorCifrado, huella, huellaToken, tokenNuevo } from "@/domain/colaboracion/cifrado";
import type { FotoImportada } from "@/lib/importar/procesar";
import { almacenLocal } from "@/lib/servidor/colaboracionLocal";
import { clienteColaboracion, ErrorServicio } from "./api";
import { huellaDelEnlace, urlParaCompartir } from "./enlace";
import { claveComprobada, prepararAportacion } from "./enviar";
import { abrirAportacion, esInservible, type Medidor } from "./recibir";

const BASE = "https://ejemplo.supabase.co/functions/v1/colaboracion";

/** Un JPEG mínimo que declara sus medidas (basta para el formato; no es una imagen de verdad). */
function jpeg(ancho: number, alto: number, relleno = 64): Uint8Array<ArrayBuffer> {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, alto >> 8, alto & 0xff, ancho >> 8, ancho & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...sof0, ...new Array<number>(relleno).fill(0x5a), 0xff, 0xd9]);
}

/** El medidor del navegador decodifica la imagen; aquí basta con leer la cabecera. */
const medidorFalso: Medidor = async (b) => medidasJpeg(b)!;

function foto(cambios: Partial<FotoImportada> = {}, copia = jpeg(3200, 2400), mini = jpeg(480, 360)): FotoImportada {
  return {
    id: "local-1",
    nombreArchivo: "IMG_20190814_123045.jpg",
    tipoArchivo: "image/jpeg",
    hash: "b".repeat(64),
    copia: new Blob([copia], { type: "image/jpeg" }),
    mini: new Blob([mini], { type: "image/jpeg" }),
    ancho: 3200,
    alto: 2400,
    anchoOriginal: 4032,
    altoOriginal: 3024,
    propuesta: {
      automatica: { fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta", pista: "camara" },
      sugerencias: [],
      escaneo: false,
      senales: [{ tipo: "exif" } as never],
    },
    ...cambios,
  };
}

/** El servicio de verdad, con su almacén en memoria, detrás de un `fetch`. */
function montar() {
  const servir = crearServicio(almacenLocal());
  const buscar = ((entrada: RequestInfo | URL, init?: RequestInit) => servir(new Request(entrada, init))) as typeof fetch;
  return clienteColaboracion(BASE, buscar);
}

/** Lo que hace el navegador del dueño al crear el enlace. */
async function crearComoDueno(cliente: ReturnType<typeof montar>) {
  const llaves = await crearLlavesDueno();
  const cruda = await clavePublicaCruda(llaves);
  const token = tokenNuevo();
  const { id, caducaEn } = await cliente.crear(aBase64url(cruda), await huellaToken(token));
  return { id, caducaEn, token, llaves, huellaClave: await huella(cruda) };
}

async function codigoDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "sin error";
  } catch (e) {
    return e instanceof ErrorServicio ? `${e.estado} ${e.codigo}` : `otro: ${String(e)}`;
  }
}

describe("subida colaborativa de punta a punta (sin navegador)", () => {
  it("una foto va cifrada del móvil de quien la manda al mazo del dueño, y se borra al recogerla", async () => {
    const cliente = montar();
    const dueno = await crearComoDueno(cliente);

    // Quien aporta abre el enlace: comprueba la clave con la huella de tras «#».
    const url = urlParaCompartir("https://web.ejemplo", "es", dueno);
    expect(url).toBe(`https://web.ejemplo/es/aportar/${dueno.id}#k=${dueno.huellaClave}`);
    const info = await cliente.info(dueno.id);
    const clave = await claveComprobada(info.clavePublica, huellaDelEnlace(new URL(url).hash)!);
    expect(clave).not.toBeNull();
    const paquete = await prepararAportacion(foto(), { autor: "  Tía Carmen  ", lote: "lote_prueba_01", enviadaEn: 1_795_000_000_000 }, clave!, dueno.id);
    await cliente.aportar(dueno.id, paquete);

    // El dueño ve que ha llegado una, la baja, la abre y la quita del servicio.
    const { aportaciones } = await cliente.listar(dueno.id, dueno.token);
    expect(aportaciones).toHaveLength(1);
    const recibida = await abrirAportacion(await cliente.descargar(dueno.id, aportaciones[0]!.id, dueno.token), dueno.llaves, dueno.id, medidorFalso);
    expect(recibida.autor).toBe("Tía Carmen");
    expect(recibida.lote).toBe("lote_prueba_01");
    expect(recibida.foto).toMatchObject({
      nombreArchivo: "IMG_20190814_123045.jpg",
      hash: "b".repeat(64),
      ancho: 3200,
      alto: 2400,
      anchoOriginal: 4032,
      altoOriginal: 3024,
      propuesta: { automatica: { fecha: { anio: 2019, mes: 8, dia: 14 } }, senales: [] },
    });
    expect(recibida.foto.id).not.toBe("local-1");
    expect(new Uint8Array(await recibida.foto.mini.arrayBuffer())).toEqual(jpeg(480, 360));
    await cliente.quitar(dueno.id, aportaciones[0]!.id, dueno.token);
    expect((await cliente.listar(dueno.id, dueno.token)).aportaciones).toEqual([]);

    await cliente.cerrar(dueno.id, dueno.token);
    expect(await codigoDe(cliente.info(dueno.id))).toBe("404 no-existe");
  });

  it("solo vale la clave de la huella del enlace", async () => {
    const cliente = montar();
    const dueno = await crearComoDueno(cliente);
    const otro = await crearComoDueno(cliente);
    const { clavePublica } = await cliente.info(dueno.id);
    expect(await claveComprobada(clavePublica, dueno.huellaClave)).not.toBeNull();
    expect(await claveComprobada(clavePublica, otro.huellaClave)).toBeNull();
    expect(await claveComprobada("no*es*base64", dueno.huellaClave)).toBeNull();
    expect(await claveComprobada(aBase64url(new Uint8Array(65)), dueno.huellaClave)).toBeNull();
  });

  it("lee la huella del enlace solo si tiene la forma de una huella", () => {
    const h = "A".repeat(43);
    expect(huellaDelEnlace(`#k=${h}`)).toBe(h);
    expect(huellaDelEnlace(`k=${h}&x=1`)).toBe(h);
    expect(huellaDelEnlace("")).toBeNull();
    expect(huellaDelEnlace("#k=corta")).toBeNull();
    expect(huellaDelEnlace(`#k=${h}!`)).toBeNull();
  });

  it("lleva la fecha y la frase que pone quien la manda; sin tocar la fecha, no la manda", async () => {
    const cliente = montar();
    const dueno = await crearComoDueno(cliente);
    const { clavePublica } = await cliente.info(dueno.id);
    const clave = (await claveComprobada(clavePublica, dueno.huellaClave))!;
    const extra = { autor: null, lote: "lote_prueba_04", enviadaEn: 1 };
    const conTodo = await prepararAportacion(foto(), { ...extra, fecha: { anio: 1998 }, descripcion: " La boda\nde los abuelos " }, clave, dueno.id);
    expect((await abrirAportacion(conTodo, dueno.llaves, dueno.id, medidorFalso)).deQuienManda).toEqual({ fecha: { anio: 1998 }, descripcion: "La boda de los abuelos" });
    // Borrada a propósito: en blanco. Y una frase demasiado larga se corta en vez de estropear el paquete.
    const borrada = await prepararAportacion(foto(), { ...extra, fecha: null, descripcion: "x".repeat(120) }, clave, dueno.id);
    expect((await abrirAportacion(borrada, dueno.llaves, dueno.id, medidorFalso)).deQuienManda).toEqual({ fecha: null, descripcion: "x".repeat(90) });
    const sinTocar = await prepararAportacion(foto(), { ...extra, descripcion: "  " }, clave, dueno.id);
    expect((await abrirAportacion(sinTocar, dueno.llaves, dueno.id, medidorFalso)).deQuienManda).toEqual({});
  });

  it("recorta el nombre del archivo y deja el autor en null si está vacío", async () => {
    const cliente = montar();
    const dueno = await crearComoDueno(cliente);
    const { clavePublica } = await cliente.info(dueno.id);
    const clave = (await claveComprobada(clavePublica, dueno.huellaClave))!;
    const paquete = await prepararAportacion(foto({ nombreArchivo: `${"x".repeat(300)}.jpg` }), { autor: "   ", lote: "lote_prueba_02", enviadaEn: 1 }, clave, dueno.id);
    const r = await abrirAportacion(paquete, dueno.llaves, dueno.id, medidorFalso);
    expect(r.autor).toBeNull();
    expect(r.foto.nombreArchivo).toHaveLength(200);
  });
});

describe("abrir una aportación", () => {
  async function paqueteDe(f: FotoImportada) {
    const llaves = await crearLlavesDueno();
    const paquete = await prepararAportacion(f, { autor: null, lote: "lote_prueba_03", enviadaEn: 1 }, await clavePublicaCruda(llaves), "inv-1");
    return { llaves, paquete };
  }

  async function motivo(p: Promise<unknown>): Promise<string> {
    try {
      await p;
      return "sin error";
    } catch (e) {
      const nombre = e instanceof ErrorAportacion ? `aportación: ${e.detalle}` : e instanceof ErrorCifrado ? `cifrado: ${e.motivo}` : `otro: ${String(e)}`;
      return `${nombre}${esInservible(e) ? " (inservible)" : ""}`;
    }
  }

  it("rechaza una copia o una miniatura más grandes de lo que hace el portal, sin abrirlas", async () => {
    let abiertas = 0;
    const contar: Medidor = async (b) => {
      abiertas++;
      return medidorFalso(b);
    };
    const grande = await paqueteDe(foto({}, jpeg(6000, 4000)));
    expect(await motivo(abrirAportacion(grande.paquete, grande.llaves, "inv-1", contar))).toBe("aportación: medidas (inservible)");
    const miniGrande = await paqueteDe(foto({}, jpeg(3200, 2400), jpeg(1200, 900)));
    expect(await motivo(abrirAportacion(miniGrande.paquete, miniGrande.llaves, "inv-1", contar))).toBe("aportación: medidas (inservible)");
    expect(abiertas).toBe(1);
  });

  it("rechaza una imagen que no se decodifica, o que no es para estas llaves o este enlace", async () => {
    const { llaves, paquete } = await paqueteDe(foto());
    const roto: Medidor = async () => {
      throw new Error("no es una imagen");
    };
    expect(await motivo(abrirAportacion(paquete, llaves, "inv-1", roto))).toBe("aportación: imagen (inservible)");
    expect(await motivo(abrirAportacion(paquete, await crearLlavesDueno(), "inv-1", medidorFalso))).toBe("cifrado: descifrado (inservible)");
    expect(await motivo(abrirAportacion(paquete, llaves, "inv-2", medidorFalso))).toBe("cifrado: descifrado (inservible)");
    expect(await motivo(abrirAportacion(paquete.slice(0, 50), llaves, "inv-1", medidorFalso))).toBe("cifrado: formato (inservible)");
  });

  it("las medidas de la copia son las que mide el navegador; las del original, como mínimo esas", async () => {
    const { llaves, paquete } = await paqueteDe(foto({ anchoOriginal: 100, altoOriginal: 5000 }));
    const r = await abrirAportacion(paquete, llaves, "inv-1", async () => ({ ancho: 2400, alto: 3200 }));
    expect(r.foto).toMatchObject({ ancho: 2400, alto: 3200, anchoOriginal: 2400, altoOriginal: 5000 });
  });

  it("un fallo de red no hace inservible el paquete: se queda para la próxima vez", () => {
    expect(esInservible(new ErrorServicio(0, "red"))).toBe(false);
    expect(esInservible(new Error("cualquier otra cosa"))).toBe(false);
  });
});

describe("cliente del servicio", () => {
  it("convierte las respuestas de error en ErrorServicio con su código", async () => {
    const cliente = montar();
    const dueno = await crearComoDueno(cliente);
    expect(await codigoDe(cliente.info("A".repeat(22)))).toBe("404 no-existe");
    expect(await codigoDe(cliente.listar(dueno.id, tokenNuevo()))).toBe("403 no-autorizado");
    expect(await codigoDe(cliente.aportar(dueno.id, new Uint8Array(200)))).toBe("400 formato");
    expect(await codigoDe(cliente.crear("no", "vale"))).toBe("400 formato");
  });

  it("sin respuesta es un error de red, y una respuesta rara no se da por buena", async () => {
    const sinRed = clienteColaboracion(BASE, (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch);
    expect(await codigoDe(sinRed.info("A".repeat(22)))).toBe("0 red");
    const rara = clienteColaboracion(BASE, (async () => new Response(JSON.stringify({ clavePublica: 1 }), { status: 200 })) as typeof fetch);
    expect(await codigoDe(rara.info("A".repeat(22)))).toBe("200 respuesta");
    const html = clienteColaboracion(BASE, (async () => new Response("<html>", { status: 502 })) as typeof fetch);
    expect(await codigoDe(html.info("A".repeat(22)))).toBe("502 desconocido");
  });

  it("manda el token del dueño en su cabecera y nunca cookies", async () => {
    const vistas: { url: string; token: string | null; credenciales: RequestCredentials | undefined }[] = [];
    const cliente = clienteColaboracion(BASE, (async (entrada: RequestInfo | URL, init?: RequestInit) => {
      vistas.push({ url: String(entrada), token: new Headers(init?.headers).get("x-token-dueno"), credenciales: init?.credentials });
      return new Response(null, { status: 204 });
    }) as typeof fetch);
    await cliente.quitar("A".repeat(22), "B".repeat(22), "token-del-dueno");
    expect(vistas).toEqual([{ url: `${BASE}/invitaciones/${"A".repeat(22)}/aportaciones/${"B".repeat(22)}`, token: "token-del-dueno", credenciales: "omit" }]);
  });
});
