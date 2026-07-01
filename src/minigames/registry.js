// Registro dos minigames (PRD seção 2). Lógica PURA, sem React — para que
// rode no cliente e no servidor (Cloud Function) e seja testável.
//
// Cada minigame declara:
//  - id, name, icon, blurb
//  - requiredFields: campos que um item precisa para entrar neste minigame
//  - scoring: configuração passada a engine/scoring.scoreRound
//  - buildRound(pool, focusItem, seed): monta os dados que a UI mostra
//  - evaluate(round, input): { answer, correct, correctText, detail }
//  - hints(round): string[]  -> [0] é GRÁTIS (sempre na tela); 1+ são pagas
//      (cada uma reduz 20% dos pontos). Sempre relacionadas ao jogo.

import { seededShuffle, hashStringToInt, mulberry32 } from '../engine/rng.js';

const MC_OPTIONS = 4; // múltipla escolha padrão (Adivinhe pela imagem)
const COUNTRY_OPTIONS = 5; // opções no "De que país é"
export const GUESS_IMAGE_STEPS = 4; // níveis de revelação (0..4)

// Dificuldade / "conhecimento geral": se a base tem `fame` (nº de Wikipédias do
// item = notoriedade), priorizamos os mais conhecidos e limitamos o tamanho.
export const GENERAL_KNOWLEDGE_TOP = 5000;

// Filtra a base para um minigame e aplica a dificuldade (conhecimento geral).
// Ordenação estável por `fame` => determinístico (cliente e servidor iguais).
// Sem `fame` (base antiga/exemplo), mantém tudo — comportamento inalterado.
export function itemsForMinigame(items, def) {
  let filtered = items.filter((it) =>
    def.requiredFields.every((f) => it[f] !== undefined && it[f] !== null && it[f] !== '')
  );
  // alguns minigames excluem categorias que não combinam (ex.: "evento" tem
  // imagem de mapa/pintura e data obscura — ruim para reconhecer/adivinhar o ano)
  if (def.excludeCategories) {
    filtered = filtered.filter((it) => !def.excludeCategories.includes(it.category));
  }
  if (!filtered.some((it) => typeof it.fame === 'number')) return filtered;
  // Ordem TOTAL e determinística: fame desc, desempate por id. Não depende da
  // ordem do items.json nem da estabilidade do sort — evita desync cliente/servidor.
  const sorted = [...filtered].sort(
    (a, b) => (b.fame ?? 0) - (a.fame ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  return sorted.slice(0, GENERAL_KNOWLEDGE_TOP);
}

// Escolhe N "distratores" determinísticos de um conjunto de valores, != correto.
function pickDistractors(values, correct, n, seed) {
  const uniq = [...new Set(values)].filter((v) => v !== correct);
  return seededShuffle(uniq, seed).slice(0, n);
}

// ---- Helpers de dica -------------------------------------------------------
function roman(n) {
  const map = [
    ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90],
    ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
  ];
  let s = '';
  let x = n;
  for (const [sym, v] of map) while (x >= v) { s += sym; x -= v; }
  return s || 'I';
}
function century(year) {
  return `século ${roman(Math.ceil(Math.abs(year) / 100))}${year < 0 ? ' a.C.' : ''}`;
}
function decade(year) {
  return year < 0 ? century(year) : `década de ${Math.floor(year / 10) * 10}`;
}
function windowOf(year, span) {
  if (year < 0) return century(year);
  const lo = Math.floor(year / span) * span;
  return `entre ${lo} e ${lo + span}`;
}
const firstLetter = (s) => {
  const t = (s || '').trim();
  return t ? t[0].toUpperCase() : '?'; // string só de espaços não quebra ('' [0] = undefined)
};

// ----------------------------------------------------------------------------

export const MINIGAMES = [
  {
    id: 'whenLaunched',
    name: 'QuandoLançou',
    icon: '📅',
    blurb: 'Veja a imagem e chute o ano.',
    requiredFields: ['name', 'image', 'year'],
    excludeCategories: ['evento'],
    scoring: { type: 'proximity', maxError: 50, k: 1.5 },
    timerSeconds: 60,
    buildRound(_pool, item) {
      return { kind: 'whenLaunched', item };
    },
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
    hints(round) {
      const it = round.item;
      const ctx = [it.category, it.country].filter(Boolean).join(' · ') || '—';
      return [
        `Contexto: ${ctx}`,
        `Foi no ${century(it.year)}`,
        `Foi ${windowOf(it.year, 40)}`,
        `Foi na ${decade(it.year)}`,
      ];
    },
  },

  {
    id: 'higherLower',
    name: 'Maior ou menor',
    icon: '⚖️',
    blurb: 'Qual item tem o número maior?',
    requiredFields: ['name', 'metric', 'metricType'],
    scoring: { type: 'binary', basePoints: 100, useCombo: true },
    timerSeconds: 45,
    buildRound(pool, item, seed) {
      // oponente com valor DIFERENTE (sem empate ambíguo): mesma métrica,
      // depois mesma categoria, depois qualquer — SEMPRE excluindo métrica igual.
      const sameMetric = pool.filter(
        (p) => p.id !== item.id && p.metricType === item.metricType && p.metric !== item.metric
      );
      const sameCatDiff = pool.filter(
        (p) => p.id !== item.id && p.category === item.category && p.metric !== item.metric
      );
      const anyDiff = pool.filter((p) => p.id !== item.id && p.metric !== item.metric);
      const others = sameMetric.length
        ? sameMetric
        : sameCatDiff.length
        ? sameCatDiff
        : anyDiff.length
        ? anyDiff
        : pool.filter((p) => p.id !== item.id);
      const opp = others[Math.floor(mulberry32(seed)() * others.length)] || item;
      const pair = seededShuffle([item, opp], seed); // ordem visual reproduzível
      return { kind: 'higherLower', a: pair[0], b: pair[1], metricType: item.metricType };
    },
    evaluate(round, input) {
      const chosen = input.choice === 'a' ? round.a : round.b;
      const other = input.choice === 'a' ? round.b : round.a;
      // estritamente maior: com oponente de métrica diferente não há empate;
      // se por acaso empatar (base degenerada), nenhuma escolha é "acerto".
      const correct = chosen.metric > other.metric;
      const metricType = round.metricType || 'valor';
      return {
        answer: { correct },
        correct,
        correctText: (round.a.metric >= round.b.metric ? round.a : round.b).name,
        detail: `${round.a.name}: ${fmt(round.a.metric)} vs ${round.b.name}: ${fmt(round.b.metric)} — ${metricType}.`,
      };
    },
    hints(round) {
      const mt = round.metricType || 'valor';
      return [
        `${round.a.name} (${round.a.country || '?'}) vs ${round.b.name} (${round.b.country || '?'})`,
        `${round.a.name}: ${fmt(round.a.metric)} ${mt}`,
        `${round.b.name}: ${fmt(round.b.metric)} ${mt}`,
      ];
    },
  },

  {
    id: 'whichCountry',
    name: 'De que país é',
    icon: '🌍',
    blurb: 'Escolha o país certo entre 5 opções.',
    requiredFields: ['name', 'country'],
    excludeCategories: ['evento'],
    scoring: { type: 'binary', basePoints: 1000, useCombo: false },
    timerSeconds: 45,
    buildRound(pool, item, seed) {
      const distractors = pickDistractors(
        pool.map((p) => p.country),
        item.country,
        COUNTRY_OPTIONS - 1,
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
    hints(round) {
      const it = round.item;
      return [
        `Categoria: ${it.category || '—'}`,
        `O país começa com "${firstLetter(it.country)}"`,
        `O nome do país tem ${it.country.length} letras`,
      ];
    },
  },

  {
    id: 'guessImage',
    name: 'Adivinhe pela imagem',
    icon: '🖼️',
    blurb: 'Veja a imagem e acerte que item é.',
    requiredFields: ['name', 'image'],
    excludeCategories: ['evento'],
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
    // input: { choice: string, revealStep: number }
    evaluate(round, input) {
      const correct = input.choice === round.item.name;
      const error = correct ? input.revealStep : GUESS_IMAGE_STEPS + 1;
      return {
        answer: { error },
        correct,
        correctText: round.item.name,
        detail: correct ? 'Acertou!' : `Era ${round.item.name}.`,
      };
    },
    hints(round) {
      const it = round.item;
      const out = [`Categoria: ${it.category || '—'}`];
      if (it.country) out.push(`País: ${it.country}`);
      if (it.year) out.push(`Época: ${decade(it.year)}`);
      out.push(`Começa com "${firstLetter(it.name)}"`);
      return out;
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
      // tolera orderedIds ausente/malformado (não derruba o envio inteiro)
      const ordered = (Array.isArray(input.orderedIds) ? input.orderedIds : []).map((id) => byId.get(id));
      const playerOrderValues = ordered.map((it) => (it ? it.year : NaN));
      const sorted = [...round.items].sort((a, b) => a.year - b.year);
      // acerto = anos em ordem não-decrescente (empates de ano são igualmente
      // válidos), coerente com a pontuação por pares — evita "errado" num 1000.
      const correct =
        playerOrderValues.length === round.items.length &&
        playerOrderValues.every((y, i) => i === 0 || playerOrderValues[i - 1] <= y);
      return {
        answer: { playerOrderValues },
        correct,
        correctText: sorted.map((it) => `${it.name} (${it.year})`).join(' → '),
        detail: correct ? 'Ordem perfeita!' : 'Veja a ordem correta abaixo.',
      };
    },
    hints(round) {
      const ys = round.items.map((i) => i.year);
      const out = [`Período: de ${Math.min(...ys)} a ${Math.max(...ys)}`];
      for (const it of round.items.slice(0, 2)) out.push(`${it.name}: ${it.year}`);
      return out;
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
