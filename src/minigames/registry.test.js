import { describe, it, expect } from 'vitest';
import {
  MINIGAMES_BY_ID,
  itemsForMinigame,
  getMinigame,
  GUESS_IMAGE_STEPS,
} from './registry.js';
import { scoreRound } from '../engine/scoring.js';

const pool = [
  { id: 'A', name: 'Alpha', year: 1990, metric: 100, metricType: 'pop', country: 'Brasil', image: 'a.jpg' },
  { id: 'B', name: 'Beta', year: 2000, metric: 200, metricType: 'pop', country: 'França', image: 'b.jpg' },
  { id: 'C', name: 'Gamma', year: 2010, metric: 50, metricType: 'pop', country: 'Japão', image: 'c.jpg' },
  { id: 'D', name: 'Delta', year: 1980, metric: 300, metricType: 'pop', country: 'Egito', image: 'd.jpg' },
];

describe('itemsForMinigame', () => {
  it('filtra por campos exigidos', () => {
    const items = [{ id: 'x', name: 'X' }, ...pool];
    const out = itemsForMinigame(items, MINIGAMES_BY_ID.whenLaunched);
    expect(out.every((i) => i.image && i.year)).toBe(true);
    expect(out).toHaveLength(pool.length);
  });
});

describe('whenLaunched', () => {
  it('chute exato => máximo', () => {
    const def = getMinigame('whenLaunched');
    const round = def.buildRound(pool, pool[0]);
    const { answer, correct } = def.evaluate(round, { guess: 1990 });
    expect(correct).toBe(true);
    expect(scoreRound(def.scoring, answer)).toBe(1000);
  });
});

describe('higherLower', () => {
  it('escolher o maior acerta', () => {
    const def = getMinigame('higherLower');
    const round = def.buildRound(pool, pool[0], 123);
    const bigger = round.a.metric >= round.b.metric ? 'a' : 'b';
    const { correct, answer } = def.evaluate(round, { choice: bigger });
    expect(correct).toBe(true);
    expect(scoreRound(def.scoring, answer, { combo: 1 })).toBe(110);
  });
});

describe('whichCountry', () => {
  it('monta 4 opções incluindo a correta', () => {
    const def = getMinigame('whichCountry');
    const round = def.buildRound(pool, pool[0], 7);
    expect(round.options).toContain('Brasil');
    expect(round.options.length).toBeLessThanOrEqual(4);
    const { correct } = def.evaluate(round, { choice: 'Brasil' });
    expect(correct).toBe(true);
  });
});

describe('guessImage', () => {
  it('acertar cedo vale mais que acertar tarde', () => {
    const def = getMinigame('guessImage');
    const round = def.buildRound(pool, pool[0], 9);
    const early = scoreRound(def.scoring, def.evaluate(round, { choice: 'Alpha', revealStep: 0 }).answer);
    const late = scoreRound(def.scoring, def.evaluate(round, { choice: 'Alpha', revealStep: 3 }).answer);
    expect(early).toBeGreaterThan(late);
    const wrong = def.evaluate(round, { choice: 'Beta', revealStep: 0 });
    expect(scoreRound(def.scoring, wrong.answer)).toBe(0);
    expect(GUESS_IMAGE_STEPS).toBeGreaterThan(0);
  });
});

describe('timeline', () => {
  it('ordem correta => 1000; embaralhada => menos', () => {
    const def = getMinigame('timeline');
    const round = def.buildRound(pool, pool[0], 5);
    const sortedIds = [...round.items].sort((a, b) => a.year - b.year).map((i) => i.id);
    const perfect = def.evaluate(round, { orderedIds: sortedIds });
    expect(perfect.correct).toBe(true);
    expect(scoreRound(def.scoring, perfect.answer)).toBe(1000);

    const reversed = def.evaluate(round, { orderedIds: [...sortedIds].reverse() });
    expect(scoreRound(def.scoring, reversed.answer)).toBeLessThan(1000);
  });
});
