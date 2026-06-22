import { describe, it, expect } from 'vitest';
import { getMinigame, itemsForMinigame } from '../minigames/registry.js';
import { makeDailyRounds, resolveRound } from './session.js';

// Garante a invariância que sustenta a carga por minigame (item "app leve"):
// o cliente usa o pool SEPARADO (campos projetados) e o servidor usa a base
// COMPLETA via itemsForMinigame. Os dois precisam reconstruir as MESMAS rodadas.

const base = Array.from({ length: 80 }, (_, i) => ({
  id: `Q${i}`,
  name: `Item ${i}`,
  year: 1700 + i,
  image: `img${i}.jpg`,
  country: ['Brasil', 'França', 'Japão', 'Egito', 'Itália'][i % 5],
  metric: (i * 91) % 5000,
  metricType: 'teste',
  category: 'cat',
  license: 'CC BY-SA 4.0',
  author: 'autor',
}));

// Simula o split.mjs: itemsForMinigame + projeção de campos.
function splitPool(def, fields) {
  return itemsForMinigame(base, def).map((it) => {
    const o = {};
    for (const f of fields) if (it[f] !== undefined) o[f] = it[f];
    return o;
  });
}

describe('determinismo cliente (pool separado) == servidor (base completa)', () => {
  it('whenLaunched: mesmos itens e mesmos pontos', () => {
    const def = getMinigame('whenLaunched');
    const proj = splitPool(def, ['id', 'name', 'image', 'year', 'category']);
    const server = makeDailyRounds(def, base, '2025-05-01'); // base completa
    const client = makeDailyRounds(def, proj, '2025-05-01'); // pool projetado

    expect(client.map((r) => r.item.id)).toEqual(server.map((r) => r.item.id));
    // mesmo chute => mesmos pontos dos dois lados
    client.forEach((r, i) => {
      const a = resolveRound(def, r, { guess: 1900 }, { format: 'daily' });
      const b = resolveRound(def, server[i], { guess: 1900 }, { format: 'daily' });
      expect(a.points).toBe(b.points);
    });
  });

  it('higherLower: mesmo oponente e mesmo vencedor', () => {
    const def = getMinigame('higherLower');
    const proj = splitPool(def, ['id', 'name', 'metric', 'metricType', 'category', 'image']);
    const server = makeDailyRounds(def, base, '2025-05-02');
    const client = makeDailyRounds(def, proj, '2025-05-02');
    client.forEach((r, i) => {
      expect(r.data.a.id).toBe(server[i].data.a.id);
      expect(r.data.b.id).toBe(server[i].data.b.id);
    });
  });

  it('whichCountry: mesma lista de países', () => {
    const def = getMinigame('whichCountry');
    const proj = splitPool(def, ['id', 'name', 'country', 'image']);
    const server = makeDailyRounds(def, base, '2025-05-03');
    const client = makeDailyRounds(def, proj, '2025-05-03');
    client.forEach((r, i) => {
      expect(r.data.countries).toEqual(server[i].data.countries);
      expect(r.data.item.id).toBe(server[i].data.item.id);
    });
  });
});
