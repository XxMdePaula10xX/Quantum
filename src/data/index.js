// Carregador da base de dados (PRD seção 3).
//
// No MVP a base é um JSON embutido no app (offline). O pipeline em
// scripts/generate produz `src/data/items.json` a partir do Wikidata.
// Quando esse arquivo existir, troque o import abaixo por:
//     import generated from './items.json';
// e use `generated`. Enquanto isso usamos `items.sample.json` (dados
// PLACEHOLDER de dev — ver aviso de licença na tela de Fontes).
//
// A base é ÚNICA: cada minigame filtra os itens que têm os campos de que
// precisa (ver minigames/registry.js -> itemsForMinigame).

import sample from './items.sample.json';

export const ITEMS = sample;
export const USING_SAMPLE_DATA = true;

// Créditos de imagem para a tela de Fontes (PRD seção 4.6 / 9).
export function imageCredits(items = ITEMS) {
  return items
    .filter((it) => it.image)
    .map((it) => ({
      id: it.id,
      name: it.name,
      image: it.image,
      license: it.license || 'desconhecida',
      author: it.author || '—',
    }));
}
