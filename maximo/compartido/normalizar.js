export const PALABRAS_VACIAS = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "del",
  "al",
  "y",
  "o",
  "a",
  "en",
  "me",
  "te",
  "se",
  "lo",
  "por",
  "para",
  "con",
  "es",
  "son",
  "mi",
  "tu",
  "mis",
  "tus",
  "su",
  "sus",
  "muy",
  "mas",
  "pero",
]);

export function normalizar(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function palabras(texto) {
  const limpio = normalizar(texto);
  if (!limpio) return [];
  return limpio.split(" ").filter((palabra) => palabra && !PALABRAS_VACIAS.has(palabra));
}

export function trigramas(palabra) {
  const borde = ` ${palabra} `;
  const salida = [];
  for (let i = 0; i <= borde.length - 3; i += 1) {
    salida.push(borde.slice(i, i + 3));
  }
  return salida;
}
