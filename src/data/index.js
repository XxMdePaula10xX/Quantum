// Carregador da base de dados (PRD seção 3).
//
// A base ATIVA é sempre `items.json` (única, embutida, offline). Tanto o app
// quanto a Cloud Function importam ESTE arquivo — assim cliente e servidor
// usam exatamente a mesma base e a validação do ranking diário sempre bate.
//
// Inicialmente `items.json` é uma cópia da base de exemplo. Para usar a base
// real, rode `npm run data:build`, que SOBRESCREVE `items.json` com os dados
// do Wikidata. Não precisa editar nada aqui.

import items from './items.json';

export const ITEMS = items;

// Detecta a base de exemplo pelo marcador de licença dos placeholders.
export const USING_SAMPLE_DATA = items.some((it) => it.license === 'PLACEHOLDER (dev)');

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
