/**
 * Cifrado de las fotos que manda la familia por el enlace del mazo (subida colaborativa), con
 * WebCrypto: el mismo código en el navegador, en Node y en Deno.
 *
 * - Quien hace el mazo crea un par de claves ECDH P-256. La privada no sale de su navegador (no se
 *   puede exportar) y la pública se publica con el enlace.
 * - El enlace lleva tras «#», que no llega a ningún servidor, la huella SHA-256 de esa clave
 *   pública: quien aporta comprueba que la clave que le da el servicio es la del dueño del mazo.
 * - Cada foto se cifra con una clave efímera: ECDH (efímera × pública del dueño), HKDF-SHA256 atado
 *   al id del enlace y AES-GCM de 256 bits. La cabecera va autenticada con el cifrado.
 * - El dueño se identifica ante el servicio con un token aleatorio de 32 bytes, del que el servicio
 *   solo guarda la huella.
 *
 * Paquete: «APR1» · clave pública efímera (65 bytes, punto sin comprimir) · iv (12) · cifrado.
 */

/** «APR1»: aportación, versión 1. El servicio comprueba esta marca sin poder leer nada más. */
export const MAGIA = Uint8Array.of(0x41, 0x50, 0x52, 0x31);
const LARGO_CLAVE = 65;
const LARGO_IV = 12;
const ETIQUETA_GCM = 16;
export const LARGO_CABECERA = MAGIA.length + LARGO_CLAVE + LARGO_IV;
/** Lo mínimo que mide un paquete: cabecera y la etiqueta de autenticación de AES-GCM. */
export const LARGO_MINIMO = LARGO_CABECERA + ETIQUETA_GCM;

const CURVA = { name: "ECDH", namedCurve: "P-256" } as const;
const codificador = new TextEncoder();

export type MotivoErrorCifrado = "formato" | "clave" | "descifrado";

export class ErrorCifrado extends Error {
  constructor(readonly motivo: MotivoErrorCifrado) {
    super(`Aportación no válida (${motivo})`);
    this.name = "ErrorCifrado";
  }
}

/** Copia en un ArrayBuffer propio (WebCrypto no acepta vistas de un SharedArrayBuffer). */
function buffer(bytes: Uint8Array): ArrayBuffer {
  const copia = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copia).set(bytes);
  return copia;
}

export function concatenar(...partes: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = partes.reduce((n, p) => n + p.byteLength, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.byteLength;
  }
  return salida;
}

export function aBase64url(bytes: Uint8Array): string {
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Lee base64url (sin relleno). Lanza ErrorCifrado("formato") si no lo es. */
export function deBase64url(texto: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(texto) || texto.length % 4 === 1) throw new ErrorCifrado("formato");
  const binario = atob(texto.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (texto.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/** Huella SHA-256, en base64url (43 caracteres). */
export async function huella(bytes: Uint8Array): Promise<string> {
  return aBase64url(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer(bytes))));
}

/** Huella del token del dueño: es lo único que guarda el servicio. */
export function huellaToken(token: string): Promise<string> {
  return huella(codificador.encode(token));
}

/** Token del dueño: 32 bytes aleatorios en base64url. */
export function tokenNuevo(): string {
  return aBase64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** Id aleatorio en base64url (16 bytes: 22 caracteres). */
export function idAleatorio(bytes = 16): string {
  return aBase64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Claves del dueño del mazo. La privada no se puede exportar: solo sirve en este navegador. */
export function crearLlavesDueno(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(CURVA, false, ["deriveBits"]);
}

/** La clave pública en crudo (65 bytes), para publicarla con el enlace. */
export async function clavePublicaCruda(llaves: CryptoKeyPair): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", llaves.publicKey));
}

/** ¿Son 65 bytes de un punto P-256 sin comprimir? (no comprueba que esté en la curva). */
export function pareceClavePublica(bytes: Uint8Array): boolean {
  return bytes.length === LARGO_CLAVE && bytes[0] === 0x04;
}

async function importarPublica(bytes: Uint8Array): Promise<CryptoKey> {
  if (!pareceClavePublica(bytes)) throw new ErrorCifrado("clave");
  try {
    return await crypto.subtle.importKey("raw", buffer(bytes), CURVA, false, []);
  } catch {
    throw new ErrorCifrado("clave");
  }
}

async function claveAes(compartido: ArrayBuffer, invitacionId: string, uso: KeyUsage): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", compartido, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: codificador.encode(`aportacion-v1:${invitacionId}`) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [uso],
  );
}

/** ¿Empieza como un paquete de aportación y tiene el largo mínimo? Lo usa también el servicio. */
export function esPaquete(bytes: Uint8Array): boolean {
  return bytes.length >= LARGO_MINIMO && MAGIA.every((b, i) => bytes[i] === b) && bytes[MAGIA.length] === 0x04;
}

/** Cifra una aportación para el dueño de la clave pública, atada al id de su enlace. */
export async function cifrarAportacion(claro: Uint8Array, clavePublicaDueno: Uint8Array, invitacionId: string): Promise<Uint8Array<ArrayBuffer>> {
  const dueno = await importarPublica(clavePublicaDueno);
  const efimera = await crypto.subtle.generateKey(CURVA, true, ["deriveBits"]);
  const publica = new Uint8Array(await crypto.subtle.exportKey("raw", efimera.publicKey));
  const compartido = await crypto.subtle.deriveBits({ name: "ECDH", public: dueno }, efimera.privateKey, 256);
  const clave = await claveAes(compartido, invitacionId, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(LARGO_IV));
  const cabecera = concatenar(MAGIA, publica, iv);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: cabecera }, clave, buffer(claro)));
  return concatenar(cabecera, cifrado);
}

/** Descifra con las claves del dueño. Lanza ErrorCifrado si el paquete no es suyo o se ha tocado. */
export async function descifrarAportacion(paquete: Uint8Array, llaves: CryptoKeyPair, invitacionId: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!esPaquete(paquete)) throw new ErrorCifrado("formato");
  const cabecera = paquete.slice(0, LARGO_CABECERA);
  const efimera = await importarPublica(paquete.subarray(MAGIA.length, MAGIA.length + LARGO_CLAVE));
  const iv = paquete.slice(MAGIA.length + LARGO_CLAVE, LARGO_CABECERA);
  let compartido: ArrayBuffer;
  try {
    compartido = await crypto.subtle.deriveBits({ name: "ECDH", public: efimera }, llaves.privateKey, 256);
  } catch {
    throw new ErrorCifrado("clave");
  }
  const clave = await claveAes(compartido, invitacionId, "decrypt");
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: cabecera }, clave, paquete.slice(LARGO_CABECERA)));
  } catch {
    throw new ErrorCifrado("descifrado");
  }
}
