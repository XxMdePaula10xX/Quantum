// Gerador pseudoaleatório determinístico (mulberry32) + utilidades.
// Determinístico = mesma seed produz sempre a mesma sequência. Usado para:
//  - permutação fixa da base (desafio diário igual para todos), e
//  - embaralhar opções de múltipla escolha de forma reproduzível.

/** @param {number} seed inteiro */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash de string -> inteiro 32 bits (para derivar seeds de chaves textuais). */
export function hashStringToInt(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Fisher-Yates determinístico. Não muta o array original.
 * @template T
 * @param {T[]} array
 * @param {number} seed
 * @returns {T[]}
 */
export function seededShuffle(array, seed) {
  const rng = mulberry32(seed >>> 0);
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Inteiro determinístico em [0, max). */
export function seededInt(seed, max) {
  return Math.floor(mulberry32(seed >>> 0)() * max);
}
