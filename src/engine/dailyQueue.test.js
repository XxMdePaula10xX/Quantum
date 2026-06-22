import { describe, it, expect } from 'vitest';
import {
  dailyItems,
  dailyItemIds,
  deterministicPermutation,
  daysSinceBase,
  ROUNDS_PER_DAY,
} from './dailyQueue.js';

const base = Array.from({ length: 50 }, (_, i) => ({ id: `Q${i}`, year: 1900 + i }));

describe('desafio diário determinístico', () => {
  it('mesma data => mesmos itens (reprodutível)', () => {
    const a = dailyItemIds(base, 'whenLaunched', '2025-03-10');
    const b = dailyItemIds(base, 'whenLaunched', '2025-03-10');
    expect(a).toEqual(b);
    expect(a).toHaveLength(ROUNDS_PER_DAY);
  });

  it('datas diferentes => janelas diferentes (sem repetir dentro do ciclo)', () => {
    const d0 = dailyItemIds(base, 'whenLaunched', '2025-01-01');
    const d1 = dailyItemIds(base, 'whenLaunched', '2025-01-02');
    expect(d0).not.toEqual(d1);
    expect(new Set([...d0, ...d1]).size).toBe(d0.length + d1.length);
  });

  it('minigames diferentes => permutações diferentes', () => {
    const a = deterministicPermutation(base, 'whenLaunched').map((x) => x.id);
    const b = deterministicPermutation(base, 'higherLower').map((x) => x.id);
    expect(a).not.toEqual(b);
    expect(new Set(a).size).toBe(base.length); // permutação completa
  });

  it('faz wrap quando a base esgota', () => {
    const small = base.slice(0, 7); // 7 itens, 5/dia
    const items = dailyItems(small, 'whenLaunched', '2025-01-02', 5);
    expect(items).toHaveLength(5);
  });

  it('daysSinceBase nunca é negativo', () => {
    expect(daysSinceBase('2020-01-01')).toBe(0);
    expect(daysSinceBase('2025-01-02')).toBe(1);
  });
});
