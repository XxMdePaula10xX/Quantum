// Sistema de pontuação padronizado (PRD seção 6).
//
// Princípios:
//  - Pontuação é matemática fixa e determinística: mesmo input => mesma saída.
//  - Teto de PONTOS_MAX (1000) por rodada ANTES de combo/tempo, para que
//    "ir bem" valha o mesmo em qualquer minigame e o ranking seja justo.
//  - Estas mesmas funções rodam no cliente (feedback imediato) e no servidor
//    (Cloud Function) para validar o ranking. NÃO importe nada de browser aqui.

export const PONTOS_MAX = 1000;
export const PONTOS_ACERTO_BASE = 100; // modo "Maior ou menor" (binário)
export const BONUS_PERFEITO = 200; // modo "Linha do tempo" (ordenação perfeita)
export const PROXIMITY_K = 1.5; // severidade padrão da curva de proximidade

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Pontuação por proximidade (modos QuandoLançou e Adivinhe pela imagem).
 *
 *   pontos = round( PONTOS_MAX * max(0, 1 - e/E)^k )
 *
 * @param {number} error  erro absoluto do chute (ex.: diferença de anos)
 * @param {number} maxError  erro máximo tolerado E (acima disso => 0 pontos)
 * @param {object} [opts]
 * @param {number} [opts.k=PROXIMITY_K]  expoente da curva
 * @param {number} [opts.maxPoints=PONTOS_MAX]
 * @returns {number} pontos inteiros [0, maxPoints]
 */
export function proximityScore(error, maxError, opts = {}) {
  const { k = PROXIMITY_K, maxPoints = PONTOS_MAX } = opts;
  if (!(maxError > 0)) return 0;
  const e = Math.abs(error);
  const ratio = clamp(1 - e / maxError, 0, 1);
  return Math.round(maxPoints * Math.pow(ratio, k));
}

/**
 * Multiplicador de combo (modo "Maior ou menor").
 * Cada acerto seguido soma 10%. combo=0 => 1.0, combo=1 => 1.1, ...
 * @param {number} combo  número de acertos consecutivos ANTES desta rodada
 */
export function comboMultiplier(combo) {
  return 1 + 0.1 * Math.max(0, combo);
}

/**
 * Pontuação binária com combo (modo "Maior ou menor" e "De que país é").
 * @param {boolean} correct
 * @param {number} combo  acertos consecutivos antes desta rodada
 * @param {object} [opts]
 * @param {number} [opts.basePoints=PONTOS_ACERTO_BASE]
 * @param {boolean} [opts.useCombo=true]
 * @returns {number} pontos da rodada (erro => 0; combo zera no chamador)
 */
export function binaryScore(correct, combo = 0, opts = {}) {
  const { basePoints = PONTOS_ACERTO_BASE, useCombo = true } = opts;
  if (!correct) return 0;
  return Math.round(basePoints * (useCombo ? comboMultiplier(combo) : 1));
}

/**
 * Conta pares (i<j) que estão na ordem relativa correta.
 * Trabalha sobre os VALORES de ordenação (ex.: anos) na ordem em que o
 * jogador colocou os itens.
 * @param {number[]} playerOrderValues  valores na ordem escolhida pelo jogador
 * @returns {{correctPairs:number, totalPairs:number, perfect:boolean}}
 */
export function countOrderedPairs(playerOrderValues) {
  const n = playerOrderValues.length;
  const totalPairs = (n * (n - 1)) / 2;
  let correctPairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // ordem alvo: crescente (mais antigo -> mais recente)
      if (playerOrderValues[i] <= playerOrderValues[j]) correctPairs++;
    }
  }
  return { correctPairs, totalPairs, perfect: totalPairs > 0 && correctPairs === totalPairs };
}

/**
 * Pontuação de ordenação (modo "Linha do tempo").
 *
 *   pares dão até (PONTOS_MAX - BONUS_PERFEITO); ordem perfeita soma BONUS_PERFEITO.
 *   => ordem 100% correta = exatamente PONTOS_MAX (respeita o teto).
 *
 * @param {number[]} playerOrderValues  valores na ordem escolhida pelo jogador
 */
export function orderingScore(playerOrderValues) {
  const { correctPairs, totalPairs, perfect } = countOrderedPairs(playerOrderValues);
  if (totalPairs === 0) return 0;
  const pairsMax = PONTOS_MAX - BONUS_PERFEITO;
  let pts = Math.round(pairsMax * (correctPairs / totalPairs));
  if (perfect) pts += BONUS_PERFEITO;
  return clamp(pts, 0, PONTOS_MAX);
}

/**
 * Bônus de tempo (somente modo "Contra o tempo").
 *   bonusTempo = 0.5 * (tempoRestante / tempoTotal)   // até +50%
 *   pontos_finais = pontos_acerto * (1 + bonusTempo)
 * Chute rápido e errado continua valendo pouco, pois pontos_acerto já é baixo.
 * @param {number} basePoints  pontos do acerto (já calculados pelo minigame)
 * @param {number} timeRemaining  tempo restante (mesma unidade de timeTotal)
 * @param {number} timeTotal
 */
export function timeBonusScore(basePoints, timeRemaining, timeTotal) {
  if (!(timeTotal > 0)) return Math.round(basePoints);
  const frac = clamp(timeRemaining / timeTotal, 0, 1);
  const bonus = 0.5 * frac;
  return Math.round(basePoints * (1 + bonus));
}

/**
 * Dispatcher genérico: dada a definição de pontuação de um minigame e a
 * resposta do jogador, calcula os pontos da rodada (antes do bônus de tempo).
 * Usado tanto no cliente quanto no servidor para garantir consistência.
 *
 * @param {object} scoring  { type, maxError?, k?, basePoints?, useCombo? }
 * @param {object} answer   formato depende do type (ver minigames/registry.js)
 * @param {object} [ctx]    { combo? }
 * @returns {number}
 */
export function scoreRound(scoring, answer, ctx = {}) {
  switch (scoring.type) {
    case 'proximity':
      return proximityScore(answer.error, scoring.maxError, {
        k: scoring.k ?? PROXIMITY_K,
        maxPoints: scoring.maxPoints ?? PONTOS_MAX,
      });
    case 'binary':
      return binaryScore(answer.correct, ctx.combo ?? 0, {
        basePoints: scoring.basePoints ?? PONTOS_ACERTO_BASE,
        useCombo: scoring.useCombo ?? true,
      });
    case 'ordering':
      return orderingScore(answer.playerOrderValues);
    default:
      throw new Error(`scoreRound: tipo de pontuação desconhecido "${scoring.type}"`);
  }
}
