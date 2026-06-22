// Carregador da base (PRD seção 3) — agora com CARGA SOB DEMANDA.
//
// Para o app ficar leve, a base NÃO é mais embutida inteira no bundle. O script
// scripts/generate/split.mjs separa `items.json` em arquivos por minigame
// (src/data/mg/<id>.json) nos hooks predev/prebuild. Aqui cada minigame é
// carregado via import dinâmico (chunk separado) só quando o jogador o abre.
//
// A Cloud Function continua usando items.json + itemsForMinigame; como os
// arquivos por minigame são exatamente itemsForMinigame(items.json, def), o
// diário determinístico bate entre cliente e servidor.

// Metadados pequenos (carregados ansiosamente): banner do menu, contagens.
const metaMod = import.meta.glob('./meta.json', { eager: true, import: 'default' });
export const META = metaMod['./meta.json'] || { sample: true, total: 0, counts: {} };
export const USING_SAMPLE_DATA = META.sample !== false;

// Carregadores lazy (cada arquivo vira um chunk separado).
const poolLoaders = import.meta.glob('./mg/*.json');
const creditsLoader = import.meta.glob('./mg/credits.json');

const cache = new Map();

/** Carrega (uma vez) o pool de itens de um minigame. */
export async function loadPool(minigameId) {
  if (cache.has(minigameId)) return cache.get(minigameId);
  const key = `./mg/${minigameId}.json`;
  const loader = poolLoaders[key];
  if (!loader) {
    throw new Error(
      `Dados de "${minigameId}" não encontrados. Rode "npm run data:split" (ou reinicie o dev).`
    );
  }
  const mod = await loader();
  const data = mod.default || mod;
  cache.set(minigameId, data);
  return data;
}

/** Carrega os créditos de imagem (tela de Fontes), sob demanda. */
export async function loadCredits() {
  const loader = creditsLoader['./mg/credits.json'];
  if (!loader) return [];
  const mod = await loader();
  return mod.default || mod;
}
