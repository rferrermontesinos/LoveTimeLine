import { describe, expect, it } from "vitest";
import {
  aBase64url,
  clavePublicaCruda,
  cifrarAportacion,
  crearLlavesDueno,
  deBase64url,
  descifrarAportacion,
  ErrorCifrado,
  esPaquete,
  huella,
  huellaToken,
  idAleatorio,
  LARGO_CABECERA,
  LARGO_MINIMO,
  pareceClavePublica,
  tokenNuevo,
} from "./cifrado";

const texto = (s: string) => new TextEncoder().encode(s);

async function motivo(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "sin error";
  } catch (e) {
    return e instanceof ErrorCifrado ? e.motivo : `otro error: ${String(e)}`;
  }
}

describe("base64url", () => {
  it("ida y vuelta con todos los bytes, sin relleno ni caracteres de URL", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const b64 = aBase64url(bytes);
    expect(b64).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(deBase64url(b64)).toEqual(bytes);
    for (let n = 0; n < 6; n++) expect(deBase64url(aBase64url(bytes.subarray(0, n)))).toEqual(bytes.subarray(0, n));
  });

  it("aguanta trozos grandes (más de 32 KB) sin desbordar la pila", () => {
    const grande = new Uint8Array(200_000).map((_, i) => (i * 7) & 0xff);
    expect(deBase64url(aBase64url(grande))).toEqual(grande);
  });

  it("rechaza lo que no es base64url", () => {
    for (const malo of ["a+b", "a/b", "abc=", "a", "ab cd", "ñ"]) expect(() => deBase64url(malo)).toThrow(ErrorCifrado);
  });
});

describe("huellas, tokens e ids", () => {
  it("la huella es el SHA-256 en base64url (43 caracteres)", async () => {
    // SHA-256 de «abc», conocido.
    expect(await huella(texto("abc"))).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
    expect(await huellaToken("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });

  it("tokens de 32 bytes e ids de 16, distintos cada vez", () => {
    const tokens = new Set(Array.from({ length: 50 }, tokenNuevo));
    expect(tokens.size).toBe(50);
    for (const t of tokens) expect(deBase64url(t)).toHaveLength(32);
    expect(idAleatorio()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(deBase64url(idAleatorio(24))).toHaveLength(24);
  });
});

describe("cifrado de una aportación", () => {
  it("quien hizo el mazo descifra lo que le mandan, atado al id del enlace", async () => {
    const llaves = await crearLlavesDueno();
    const publica = await clavePublicaCruda(llaves);
    expect(pareceClavePublica(publica)).toBe(true);
    const claro = texto("una foto cualquiera, en bytes");
    const paquete = await cifrarAportacion(claro, publica, "enlace-1");
    expect(esPaquete(paquete)).toBe(true);
    expect(paquete.length).toBe(LARGO_CABECERA + claro.length + 16);
    expect(await descifrarAportacion(paquete, llaves, "enlace-1")).toEqual(claro);
  });

  it("cada envío usa una clave efímera y un iv nuevos: el mismo contenido nunca se repite", async () => {
    const llaves = await crearLlavesDueno();
    const publica = await clavePublicaCruda(llaves);
    const a = await cifrarAportacion(texto("igual"), publica, "e");
    const b = await cifrarAportacion(texto("igual"), publica, "e");
    expect(aBase64url(a)).not.toBe(aBase64url(b));
  });

  it("la clave privada no se puede exportar", async () => {
    const llaves = await crearLlavesDueno();
    expect(llaves.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("pkcs8", llaves.privateKey)).rejects.toThrow();
  });

  it("no se descifra con otro id de enlace, con otras llaves ni si se toca un solo byte", async () => {
    const llaves = await crearLlavesDueno();
    const publica = await clavePublicaCruda(llaves);
    const paquete = await cifrarAportacion(texto("secreto"), publica, "enlace-1");

    expect(await motivo(descifrarAportacion(paquete, llaves, "enlace-2"))).toBe("descifrado");
    expect(await motivo(descifrarAportacion(paquete, await crearLlavesDueno(), "enlace-1"))).toBe("descifrado");
    // Un byte del contenido, del iv o de la clave efímera: la cabecera también va autenticada.
    for (const i of [paquete.length - 1, LARGO_CABECERA - 1, 10]) {
      const tocado = paquete.slice();
      tocado[i]! ^= 0x01;
      expect(["descifrado", "clave"]).toContain(await motivo(descifrarAportacion(tocado, llaves, "enlace-1")));
    }
  });

  it("rechaza paquetes que no lo son y claves que no son de la curva", async () => {
    const llaves = await crearLlavesDueno();
    expect(await motivo(descifrarAportacion(new Uint8Array(LARGO_MINIMO - 1), llaves, "e"))).toBe("formato");
    const sinMarca = new Uint8Array(LARGO_MINIMO + 10);
    expect(esPaquete(sinMarca)).toBe(false);
    expect(await motivo(descifrarAportacion(sinMarca, llaves, "e"))).toBe("formato");

    // Marca correcta y un punto que no está en la curva.
    const falso = new Uint8Array(LARGO_MINIMO + 10);
    falso.set([0x41, 0x50, 0x52, 0x31, 0x04]);
    falso.fill(0x07, 5, 69);
    expect(esPaquete(falso)).toBe(true);
    expect(await motivo(descifrarAportacion(falso, llaves, "e"))).toBe("clave");

    expect(await motivo(cifrarAportacion(texto("x"), new Uint8Array(65), "e"))).toBe("clave");
    expect(await motivo(cifrarAportacion(texto("x"), new Uint8Array(33).fill(2), "e"))).toBe("clave");
  });
});
