// Lógica de sessão de jogo, agnóstica de framework (PRD seção 5).
// Os 3 formatos (Diário, Infinito, Contra o tempo) compartilham este motor.

import { itemsForMinigame, roundSeed } from '../minigames/registry.js';
import { dailyItems, ROUNDS_PER_DAY } from './dailyQueue.js';
import { scoreRound, timeBonusScore, applyHintPenalty } from './scoring.js';

export const FORMATS = {
  daily: { id: 'daily', name: 'Diário', ranked: true },
  infinite: { id: 'infinite', name: 'Infinito', ranked: false },
  timer: { id: 'timer', name: 'Contra o tempo', ranked: true },
};

/** Constrói uma rodada (dados + seed) para um item específico. */
export function buildRoundFor(def, pool, item, salt = 0) {
  const seed = roundSeed(def.id, item.id, salt);
  return { item, data: def.buildRound(pool, item, seed), seed, salt };
}

/**
 * As 5 rodadas determinísticas do diário a partir de um pool JÁ FILTRADO
 * (itemsForMinigame aplicado). Use isto quando o pool já é o arquivo por
 * minigame (cliente) para não refiltrar a cada chamada.
 */
export function makeDailyRoundsFromPool(def, pool, date) {
  const chosen = dailyItems(pool, def.id, date, ROUNDS_PER_DAY);
  return chosen.map((item) => buildRoundFor(def, pool, item));
}

/** Como makeRandomRound, mas a partir de um pool JÁ FILTRADO. */
export function makeRandomRoundFromPool(def, pool, rnd = Math.random()) {
  const item = pool[Math.floor(rnd * pool.length)];
  // salt aleatório para variar opções/oponente entre repetições do mesmo item
  return buildRoundFor(def, pool, item, Math.floor(rnd * 1e9));
}

/** As 5 rodadas determinísticas do diário para uma data (filtra o pool). */
export function makeDailyRounds(def, items, date) {
  return makeDailyRoundsFromPool(def, itemsForMinigame(items, def), date);
}

/** Uma rodada aleatória (modos Infinito/Contra o tempo). `rnd` em [0,1). */
export function makeRandomRound(def, items, rnd = Math.random()) {
  return makeRandomRoundFromPool(def, itemsForMinigame(items, def), rnd);
}

/**
 * Avalia o input do jogador e calcula os pontos da rodada.
 * @param {object} def  definição do minigame
 * @param {object} round  { item, data }
 * @param {object} input
 * @param {object} [ctx]  { combo, format, timeRemaining, timeTotal }
 * @returns {{ correct, correctText, detail, basePoints, points, combo }}
 */
export function resolveRound(def, round, input, ctx = {}) {
  const result = def.evaluate(round.data, input);
  const raw = scoreRound(def.scoring, result.answer, { combo: ctx.combo ?? 0 });
  // penalidade por dicas pagas (mesmo cálculo no servidor, via input.hintsUsed)
  const basePoints = applyHintPenalty(raw, input.hintsUsed ?? 0);

  // combo só existe em minigames binários com useCombo
  let nextCombo = ctx.combo ?? 0;
  if (def.scoring.type === 'binary' && def.scoring.useCombo) {
    nextCombo = result.correct ? nextCombo + 1 : 0;
  }

  let points = basePoints;
  if (ctx.format === 'timer') {
    points = timeBonusScore(basePoints, ctx.timeRemaining ?? 0, ctx.timeTotal ?? 1);
  }

  return {
    correct: result.correct,
    correctText: result.correctText,
    detail: result.detail,
    answer: result.answer, // guardado para reenvio/validação no servidor
    basePoints,
    points,
    combo: nextCombo,
  };
}
