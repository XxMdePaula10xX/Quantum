import { describe, it, expect } from 'vitest';
import {
  proximityScore,
  comboMultiplier,
  binaryScore,
  countOrderedPairs,
  orderingScore,
  timeBonusScore,
  scoreRound,
  applyHintPenalty,
  PONTOS_MAX,
  PONTOS_ACERTO_BASE,
} from './scoring.js';

describe('proximityScore', () => {
  it('erro 0 => pontuação máxima', () => {
    expect(proximityScore(0, 50)).toBe(PONTOS_MAX);
  });

  it('erro >= E => 0 pontos', () => {
    expect(proximityScore(50, 50)).toBe(0);
    expect(proximityScore(100, 50)).toBe(0);
  });

  it('reproduz os exemplos do PRD (E=50, k=1.5)', () => {
    // PRD cita "~857" para erro 5; o valor exato de 0.9^1.5 * 1000 é 853.8 -> 854.
    expect(proximityScore(5, 50)).toBe(854);
    expect(proximityScore(25, 50)).toBe(354);
  });

  it('é simétrico em torno de erros positivos/negativos', () => {
    expect(proximityScore(-10, 50)).toBe(proximityScore(10, 50));
  });

  it('maxError inválido => 0', () => {
    expect(proximityScore(3, 0)).toBe(0);
  });
});

describe('comboMultiplier / binaryScore', () => {
  it('combo soma 10% por acerto consecutivo', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(3)).toBeCloseTo(1.3);
  });

  it('acerto sem combo vale a base', () => {
    expect(binaryScore(true, 0)).toBe(PONTOS_ACERTO_BASE);
  });

  it('acerto com combo aplica multiplicador', () => {
    expect(binaryScore(true, 2)).toBe(120); // 100 * 1.2
  });

  it('erro vale 0', () => {
    expect(binaryScore(false, 5)).toBe(0);
  });
});

describe('countOrderedPairs / orderingScore', () => {
  it('ordem perfeita = todos os pares e PONTOS_MAX', () => {
    const { correctPairs, totalPairs, perfect } = countOrderedPairs([1, 2, 3, 4]);
    expect(correctPairs).toBe(totalPairs);
    expect(perfect).toBe(true);
    expect(orderingScore([1900, 1950, 2000])).toBe(PONTOS_MAX);
  });

  it('ordem invertida => poucos pares', () => {
    const { correctPairs } = countOrderedPairs([4, 3, 2, 1]);
    expect(correctPairs).toBe(0);
    expect(orderingScore([2000, 1950, 1900])).toBe(0);
  });

  it('ordem parcial fica entre 0 e PONTOS_MAX e não é perfeita', () => {
    const pts = orderingScore([1900, 2000, 1950]);
    expect(pts).toBeGreaterThan(0);
    expect(pts).toBeLessThan(PONTOS_MAX);
  });
});

describe('timeBonusScore', () => {
  it('sem tempo restante => sem bônus', () => {
    expect(timeBonusScore(800, 0, 60)).toBe(800);
  });

  it('tempo total restante => +50%', () => {
    expect(timeBonusScore(800, 60, 60)).toBe(1200);
  });

  it('metade do tempo => +25%', () => {
    expect(timeBonusScore(800, 30, 60)).toBe(1000);
  });

  it('chute rápido e ruim continua valendo pouco', () => {
    expect(timeBonusScore(0, 60, 60)).toBe(0);
  });
});

describe('applyHintPenalty', () => {
  it('0 dicas pagas => sem penalidade', () => {
    expect(applyHintPenalty(1000, 0)).toBe(1000);
  });
  it('cada dica paga reduz 20% (multiplicativo)', () => {
    expect(applyHintPenalty(1000, 1)).toBe(800);
    expect(applyHintPenalty(1000, 2)).toBe(640);
    expect(applyHintPenalty(1000, 3)).toBe(512);
  });
  it('nunca aumenta os pontos', () => {
    expect(applyHintPenalty(100, 5)).toBeLessThan(100);
  });
});

describe('scoreRound dispatcher', () => {
  it('proximity', () => {
    expect(scoreRound({ type: 'proximity', maxError: 50 }, { error: 0 })).toBe(PONTOS_MAX);
  });
  it('binary com combo do contexto', () => {
    expect(scoreRound({ type: 'binary' }, { correct: true }, { combo: 1 })).toBe(110);
  });
  it('ordering', () => {
    expect(scoreRound({ type: 'ordering' }, { playerOrderValues: [1, 2, 3] })).toBe(PONTOS_MAX);
  });
  it('tipo desconhecido lança', () => {
    expect(() => scoreRound({ type: 'wat' }, {})).toThrow();
  });
});
