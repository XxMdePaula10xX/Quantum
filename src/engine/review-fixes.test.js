// Regressões dos bugs achados na revisão end-to-end (workflow ultracode).
import { describe, it, expect } from 'vitest';
import { applyHintPenalty, proximityScore } from './scoring.js';
import { daysSinceBase } from './dailyQueue.js';
import { getMinigame } from '../minigames/registry.js';

describe('regressões da revisão E2E', () => {
  it('applyHintPenalty não é burlável por overflow int32', () => {
    expect(applyHintPenalty(1000, 0)).toBe(1000);
    expect(applyHintPenalty(1000, 3)).toBe(512);
    // valor gigante => penalidade máxima (~0), NUNCA pontos cheios (era o furo)
    expect(applyHintPenalty(1000, 2147483648)).toBe(0);
    // negativo clampa a 0 dica
    expect(applyHintPenalty(1000, -5)).toBe(1000);
  });

  it('proximityScore não propaga NaN', () => {
    expect(proximityScore(NaN, 100)).toBe(0);
    expect(proximityScore(undefined, 100)).toBe(0);
    expect(proximityScore(0, 100)).toBe(1000);
  });

  it('daysSinceBase tolera data malformada (sem NaN)', () => {
    expect(daysSinceBase('lixo')).toBe(0);
    expect(daysSinceBase('2025-01-01')).toBe(0);
    expect(daysSinceBase('2025-01-02')).toBe(1);
  });

  it('higherLower: acerto é estritamente maior (empate não é acerto)', () => {
    const def = getMinigame('higherLower');
    const tie = { kind: 'higherLower', a: { id: 'x', name: 'X', metric: 5 }, b: { id: 'y', name: 'Y', metric: 5 }, metricType: 'v' };
    expect(def.evaluate(tie, { choice: 'a' }).correct).toBe(false);
    expect(def.evaluate(tie, { choice: 'b' }).correct).toBe(false);
    const clear = { kind: 'higherLower', a: { id: 'x', name: 'X', metric: 9 }, b: { id: 'y', name: 'Y', metric: 2 }, metricType: 'v' };
    expect(def.evaluate(clear, { choice: 'a' }).correct).toBe(true);
    expect(def.evaluate(clear, { choice: 'b' }).correct).toBe(false);
  });

  it('timeline: ordenação válida com anos empatados é acerto e input malformado não quebra', () => {
    const def = getMinigame('timeline');
    const items = [
      { id: 'a', name: 'A', year: 2000 },
      { id: 'b', name: 'B', year: 2000 },
      { id: 'c', name: 'C', year: 2010 },
    ];
    const round = { kind: 'timeline', items };
    // empate de ano resolvido em ordem diferente do sort, mas monotônica => acerto
    expect(def.evaluate(round, { orderedIds: ['b', 'a', 'c'] }).correct).toBe(true);
    // fora de ordem => não é acerto
    expect(def.evaluate(round, { orderedIds: ['c', 'a', 'b'] }).correct).toBe(false);
    // orderedIds ausente não lança e não é acerto
    const res = def.evaluate(round, {});
    expect(res.correct).toBe(false);
    expect(Array.isArray(res.answer.playerOrderValues)).toBe(true);
  });
});
