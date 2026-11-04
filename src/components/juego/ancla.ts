/**
 * El ancla de la URL (`location.hash`) como texto, sin la almohadilla y descodificada: el
 * navegador escribe «#cu%C3%A9ntalo» donde el enlace decía «#cuéntalo». Lógica pura, para probarla.
 *
 * Nunca lanza. Un ancla con un «%» suelto o con un escape cortado (un enlace pegado a medias en una
 * app de mensajería, como «#%E0%A4%A») haría saltar a `decodeURIComponent` y, al leerse mientras
 * se pinta la página, la tiraría entera. En ese caso se devuelve tal cual: no coincidirá con
 * ninguna pestaña y se abre la primera.
 */
export function leerAncla(hash: string): string {
  const texto = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}
