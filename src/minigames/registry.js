// Registro dos minigames (PRD seção 2). Lógica PURA, sem React — para que
// rode no cliente e no servidor (Cloud Function) e seja testável.
//
// Cada minigame declara:
//  - id, name, icon, blurb
//  - requiredFields: campos que um item precisa para entrar neste minigame
//  - scoring: configuração passada a engine/scoring.scoreRound
//  - buildRound(pool, focusItem, seed): monta os dados que a UI mostra
//  - evaluate(round, input): { answer, correct, correctText, detail }
//      answer  -> objeto consumido por scoreRound (mesmo no cliente e servidor)
//      correct -> boolean (para combo / feedback)
//      correctText -> resposta correta para o feedback pós-resposta

import { seededShuffle, hashStringToInt, mulberry32 } from '../engine/rng.js';

const MC_OPTIONS = 4; // opções de múltipla escolha
export const GUESS_IMAGE_STEPS = 4; // níveis de revelação (0..4)

// Filtra a base mantendo só itens que têm todos os campos exigidos.
export function itemsForMinigame(items, def) {
  return items.filter((it) =>
    def.requiredFields.every((f) => it[f] !== undefined && it[f] !== null && it[f] !== '')
  );
}

// Escolhe N "distratores" determinísticos de um conjunto de valores, != correto.
function pickDistractors(values, correct, n, seed) {
  const uniq = [...new Set(values)].filter((v) => v !== correct);
  return seededShuffle(uniq, seed).slice(0, n);
}

// ----------------------------------------------------------------------------

export const MINIGAMES = [
  {
    id: 'whenLaunched',
    name: 'QuandoLançou',
    icon: '📅',
    blurb: 'Veja a imagem e chute o ano.',
    requiredFields: ['name', 'image', 'year'],
    scoring: { type: 'proximity', maxError: 50, k: 1.5 },
    timerSeconds: 60,
    buildRound(_pool, item) {
      return { kind: 'whenLaunched', item };
    },
    // input: { guess: number }
    evaluate(round, input) {
      const guess = Number(input.guess);
      const error = Math.abs(guess - round.item.year);
      return {
        answer: { error },
        correct: error === 0,
        correctText: String(round.item.year),
        detail: `Você chutou ${guess} — diferença de ${error} ano(s).`,
      };
    },
  },

  {
    id: 'higherLower',
    name: 'Maior ou menor',
    icon: '⚖️',
    blurb: 'Qual item tem o número maior?',
    requiredFields: ['name', 'metric'],
    scoring: { type: 'binary', basePoints: 100, useCombo: true },
    timerSeconds: 45,
    buildRound(pool, item, seed) {
      // escolhe um oponente determinístico != item
      const others = pool.filter((p) => p.id !== item.id);
      const opp = others[Math.floor(mulberry32(seed)() * others.length)] || item;
      const pair = seededShuffle([item, opp], seed); // ordem visual reproduzível
      return { kind: 'higherLower', a: pair[0], b: pair[1] };
    },
    // input: { choice: 'a' | 'b' }
    evaluate(round, input) {
      const chosen = input.choice === 'a' ? round.a : round.b;
      const other = input.choice === 'a' ? round.b : round.a;
      const correct = chosen.metric >= other.metric;
      const metricType = round.a.metricType || 'valor';
      return {
        answer: { correct },
        correct,
        correctText: (round.a.metric >= round.b.metric ? round.a : round.b).name,
        detail: `${round.a.name}: ${fmt(round.a.metric)} vs ${round.b.name}: ${fmt(
          round.b.metric
        )} (${metricType}).`,
      };
    },
  },

  {
    id: 'whichCountry',
    name: 'De que país é',
    icon: '🌍',
    blurb: 'Adivinhe o país do item.',
    requiredFields: ['name', 'country'],
    scoring: { type: 'binary', basePoints: 1000, useCombo: false },
    timerSeconds: 45,
    buildRound(pool, item, seed) {
      const distractors = pickDistractors(
        pool.map((p) => p.country),
        item.country,
        MC_OPTIONS - 1,
        seed
      );
      const options = seededShuffle([item.country, ...distractors], seed + 1);
      return { kind: 'whichCountry', item, options };
    },
    // input: { choice: string (país) }
    evaluate(round, input) {
      const correct = input.choice === round.item.country;
      return {
        answer: { correct },
        correct,
        correctText: round.item.country,
        detail: correct ? 'Acertou o país!' : `Era ${round.item.country}.`,
      };
    },
  },

  {
    id: 'guessImage',
    name: 'Adivinhe pela imagem',
    icon: '🖼️',
    blurb: 'A imagem revela aos poucos — acerte o quanto antes.',
    requiredFields: ['name', 'image'],
    scoring: { type: 'proximity', maxError: GUESS_IMAGE_STEPS + 1, k: 1 },
    timerSeconds: 60,
    buildRound(pool, item, seed) {
      const distractors = pickDistractors(
        pool.map((p) => p.name),
        item.name,
        MC_OPTIONS - 1,
        seed
      );
      const options = seededShuffle([item.name, ...distractors], seed + 1);
      return { kind: 'guessImage', item, options, steps: GUESS_IMAGE_STEPS };
    },
    // input: { choice: string, revealStep: number }  (revealStep = nível revelado ao chutar)
    evaluate(round, input) {
      const correct = input.choice === round.item.name;
      // proximidade: menos revelação usada => menos erro => mais pontos.
      const error = correct ? input.revealStep : GUESS_IMAGE_STEPS + 1;
      return {
        answer: { error },
        correct,
        correctText: round.item.name,
        detail: correct
          ? `Acertou com ${input.revealStep}/${GUESS_IMAGE_STEPS} revelações.`
          : `Era ${round.item.name}.`,
      };
    },
  },

  {
    id: 'timeline',
    name: 'Linha do tempo',
    icon: '⏳',
    blurb: 'Ordene os itens do mais antigo ao mais recente.',
    requiredFields: ['name', 'year'],
    scoring: { type: 'ordering' },
    timerSeconds: 60,
    setSize: 4,
    buildRound(pool, item, seed) {
      const size = 4;
      const others = seededShuffle(
        pool.filter((p) => p.id !== item.id),
        seed
      ).slice(0, size - 1);
      const set = seededShuffle([item, ...others], seed + 1);
      return { kind: 'timeline', items: set };
    },
    // input: { orderedIds: string[] }
    evaluate(round, input) {
      const byId = new Map(round.items.map((it) => [it.id, it]));
      const ordered = input.orderedIds.map((id) => byId.get(id));
      const playerOrderValues = ordered.map((it) => it.year);
      const sorted = [...round.items].sort((a, b) => a.year - b.year);
      const correct = ordered.every((it, i) => it.id === sorted[i].id);
      return {
        answer: { playerOrderValues },
        correct,
        correctText: sorted.map((it) => `${it.name} (${it.year})`).join(' → '),
        detail: correct ? 'Ordem perfeita!' : 'Veja a ordem correta abaixo.',
      };
    },
  },
];

export const MINIGAMES_BY_ID = Object.fromEntries(MINIGAMES.map((m) => [m.id, m]));

export function getMinigame(id) {
  const m = MINIGAMES_BY_ID[id];
  if (!m) throw new Error(`Minigame desconhecido: ${id}`);
  return m;
}

// Seed determinística para uma (minigame, item, contexto) — usada para que o
// servidor reconstrua exatamente a mesma rodada do cliente no modo diário.
export function roundSeed(minigameId, itemId, salt = 0) {
  return (hashStringToInt(`${minigameId}:${itemId}`) + salt) >>> 0;
}

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('pt-BR') : String(n);
}
