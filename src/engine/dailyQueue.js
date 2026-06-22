// Seleção determinística do desafio diário (PRD seção 5).
//
// Objetivo: todos os jogadores recebem os MESMOS itens no mesmo dia, e os
// itens NÃO se repetem ao longo dos dias (até esgotar a base).
//
// Como: a base de cada minigame é embaralhada uma única vez com uma seed fixa
// (permutação determinística). O dia escolhe uma "janela" de ROUNDS_PER_DAY
// itens a partir de  indiceDoDia = diasDesdeBase * ROUNDS_PER_DAY.
// Quando a base esgota, faz wrap (volta ao início) — i.e. repetição só após
// percorrer toda a base.

import { seededShuffle, hashStringToInt } from './rng.js';

export const ROUNDS_PER_DAY = 5;

// Data base do "calendário" do jogo (UTC). Dia 0 do desafio diário.
export const BASE_DATE = '2025-01-01';

/** Converte 'YYYY-MM-DD' para o número de dias inteiros desde a época (UTC). */
export function dateToDayNumber(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** 'YYYY-MM-DD' de hoje em UTC (chave de dia estável entre fusos). */
export function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Dias decorridos desde BASE_DATE (>= 0). */
export function daysSinceBase(dateStr) {
  return Math.max(0, dateToDayNumber(dateStr) - dateToDayNumber(BASE_DATE));
}

/**
 * Permutação determinística da base de um minigame. A seed deriva do id do
 * minigame, então cada minigame tem sua própria ordem fixa e estável.
 * @template T
 * @param {T[]} items
 * @param {string} minigameId
 * @returns {T[]}
 */
export function deterministicPermutation(items, minigameId) {
  return seededShuffle(items, hashStringToInt(`quantum:${minigameId}`));
}

/**
 * Retorna os itens do desafio diário para uma data.
 * @template T
 * @param {T[]} items  base completa do minigame
 * @param {string} minigameId
 * @param {string} dateStr  'YYYY-MM-DD'
 * @param {number} [count=ROUNDS_PER_DAY]
 * @returns {T[]}
 */
export function dailyItems(items, minigameId, dateStr, count = ROUNDS_PER_DAY) {
  if (!items.length) return [];
  const perm = deterministicPermutation(items, minigameId);
  const start = (daysSinceBase(dateStr) * count) % perm.length;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(perm[(start + i) % perm.length]);
  }
  return out;
}

/** IDs dos itens do diário (para validação no servidor). */
export function dailyItemIds(items, minigameId, dateStr, count = ROUNDS_PER_DAY) {
  return dailyItems(items, minigameId, dateStr, count).map((it) => it.id);
}
