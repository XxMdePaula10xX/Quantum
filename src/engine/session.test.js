import { describe, it, expect } from 'vitest';
import { makeDailyRounds, resolveRound, buildRoundFor } from './session.js';
import { getMinigame, itemsForMinigame } from '../minigames/registry.js';

const items = Array.from({ length: 60 }, (_, i) => ({
  id: `Q${i}`,
  name: `Item ${i}`,
  year: 1900 + i,
  image: `img${i}.jpg`,
  country: ['Brasil', 'França', 'Japão', 'Egito'][i % 4],
  metric: (i * 37) % 1000,
  metricType: 'teste',
}));

describe('reconstrução determinística (cliente == servidor)', () => {
  it('makeDailyRounds produz as MESMAS rodadas em duas chamadas', () => {
    const def = getMinigame('whenLaunched');
    const a = makeDailyRounds(def, items, '2025-04-01');
    const b = makeDailyRounds(def, items, '2025-04-01');
    expect(a.map((r) => r.item.id)).toEqual(b.map((r) => r.item.id));
    expect(a.map((r) => r.seed)).toEqual(b.map((r) => r.seed));
  });

  it('fluxo diário do QuandoLançou: chutes perfeitos => 5000', () => {
    const def = getMinigame('whenLaunched');
    const rounds = makeDailyRounds(def, items, '2025-04-01');
    let total = 0;
    for (const r of rounds) {
      const res = resolveRound(def, r, { guess: r.item.year }, { format: 'daily' });
      expect(res.correct).toBe(true);
      total += res.points;
    }
    expect(total).toBe(5000);
  });

  it('combo acumula no Maior ou menor ao acertar em sequência', () => {
    const def = getMinigame('higherLower');
    const pool = itemsForMinigame(items, def);
    let combo = 0;
    const points = [];
    for (let i = 0; i < 3; i++) {
      const round = buildRoundFor(def, pool, pool[i], i);
      const bigger = round.data.a.metric >= round.data.b.metric ? 'a' : 'b';
      const res = resolveRound(def, round, { choice: bigger }, { combo });
      combo = res.combo;
      points.push(res.points);
    }
    expect(points).toEqual([100, 110, 120]); // combo cresce 10% por acerto
  });

  it('dicas pagas reduzem os pontos (cliente e servidor usam input.hintsUsed)', () => {
    const def = getMinigame('whenLaunched');
    const round = buildRoundFor(def, items, items[0], 0);
    const semDica = resolveRound(def, round, { guess: items[0].year }, {});
    const comDuas = resolveRound(def, round, { guess: items[0].year, hintsUsed: 2 }, {});
    expect(semDica.points).toBe(1000);
    expect(comDuas.points).toBe(640); // 1000 * 0.8^2
  });

  it('bônus de tempo aumenta os pontos no formato timer', () => {
    const def = getMinigame('whenLaunched');
    const round = buildRoundFor(def, items, items[0], 0);
    const noTime = resolveRound(def, round, { guess: items[0].year }, { format: 'timer', timeRemaining: 0, timeTotal: 60 });
    const fullTime = resolveRound(def, round, { guess: items[0].year }, { format: 'timer', timeRemaining: 60, timeTotal: 60 });
    expect(fullTime.points).toBeGreaterThan(noTime.points);
    expect(fullTime.points).toBe(1500); // 1000 * (1 + 0.5)
  });
});
