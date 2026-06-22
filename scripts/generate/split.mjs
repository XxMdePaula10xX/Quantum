// Separa a base única (items.json) em arquivos POR MINIGAME, para o app
// carregar sob demanda (lazy) — em vez de embutir os 27k itens no bundle.
//
// Determinismo do diário: cada arquivo por minigame é exatamente
//   itemsForMinigame(items.json, def)   (mesma função e ordem do app/servidor),
// então o cliente (que usa o arquivo separado) e a Cloud Function (que usa
// items.json + itemsForMinigame) reconstroem as MESMAS rodadas.
//
// Roda automaticamente em `npm run dev` / `npm run build` (hooks predev/prebuild)
// e no fim de `npm run data:build`. Standalone: `npm run data:split`.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MINIGAMES, itemsForMinigame } from '../../src/minigames/registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../../src/data');
const MG_DIR = resolve(DATA, 'mg');

// Campos mantidos por minigame (superset do que buildRound/evaluate/view usam).
// Reduz o tamanho de cada arquivo sem afetar a ordem/ids (logo, o diário
// continua determinístico).
const PROJECT = {
  whenLaunched: ['id', 'name', 'image', 'year', 'category'],
  higherLower: ['id', 'name', 'metric', 'metricType', 'category', 'image'],
  whichCountry: ['id', 'name', 'country', 'image'],
  guessImage: ['id', 'name', 'image'],
  timeline: ['id', 'name', 'year'],
};

const project = (item, fields) => {
  const out = {};
  for (const f of fields) if (item[f] !== undefined) out[f] = item[f];
  return out;
};

function kb(str) {
  return `${(Buffer.byteLength(str) / 1024).toFixed(0)} KB`;
}

export async function split({ quiet = false } = {}) {
  const items = JSON.parse(await readFile(resolve(DATA, 'items.json'), 'utf8'));
  await mkdir(MG_DIR, { recursive: true });

  const counts = {};
  for (const def of MINIGAMES) {
    const pool = itemsForMinigame(items, def).map((it) => project(it, PROJECT[def.id]));
    counts[def.id] = pool.length;
    const json = JSON.stringify(pool);
    await writeFile(resolve(MG_DIR, `${def.id}.json`), json);
    if (!quiet) console.log(`  ${def.id.padEnd(14)} ${String(pool.length).padStart(6)} itens  ${kb(json)}`);
  }

  // Créditos (tela de Fontes) — só itens com imagem; carregado sob demanda.
  const credits = items
    .filter((it) => it.image)
    .map((it) => ({
      id: it.id,
      name: it.name,
      image: it.image,
      license: it.license || 'desconhecida',
      author: it.author || '—',
    }));
  await writeFile(resolve(MG_DIR, 'credits.json'), JSON.stringify(credits));

  // Metadados pequenos (carregados ansiosamente: banner do menu, contagens).
  const meta = {
    sample: items.some((it) => it.license === 'PLACEHOLDER (dev)'),
    total: items.length,
    counts,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(resolve(DATA, 'meta.json'), JSON.stringify(meta, null, 2));

  if (!quiet) {
    console.log(`  credits        ${String(credits.length).padStart(6)} imagens`);
    console.log(`✓ base separada por minigame em src/data/mg/`);
  }
  return meta;
}

// Execução direta (não quando importado por build.mjs).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  split().catch((e) => {
    console.error('Falha ao separar a base:', e.message);
    process.exitCode = 1;
  });
}
