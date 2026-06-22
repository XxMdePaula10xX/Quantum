// Lógica de sessão de jogo, agnóstica de framework (PRD seção 5).
// Os 3 formatos (Diário, Infinito, Contra o tempo) compartilham este motor.

import { itemsForMinigame, roundSeed } from '../minigames/registry.js';
import { dailyItems, ROUNDS_PER_DAY } from './dailyQueue.js';
import { scoreRound, timeBonusScore } from './scoring.js';

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

/** As 5 rodadas determinísticas do diário para uma data. */
export function makeDailyRounds(def, items, date) {
  const pool = itemsForMinigame(items, def);
  const chosen = dailyItems(pool, def.id, date, ROUNDS_PER_DAY);
  return chosen.map((item) => buildRoundFor(def, pool, item));
}

/** Uma rodada aleatória (modos Infinito/Contra o tempo). `rnd` em [0,1). */
export function makeRandomRound(def, items, rnd = Math.random()) {
  const pool = itemsForMinigame(items, def);
  const item = pool[Math.floor(rnd * pool.length)];
  // salt aleatório para variar opções/oponente entre repetições do mesmo item
  return buildRoundFor(def, pool, item, Math.floor(rnd * 1e9));
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
  const basePoints = scoreRound(def.scoring, result.answer, { combo: ctx.combo ?? 0 });

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
