// Pipeline de geração da base (PRD seção 3). Roda as queries SPARQL no
// Wikidata, enriquece licença/autor das imagens via API do Commons, normaliza,
// deduplica e escreve `src/data/items.json` (base única, offline).
//
// Uso:  node scripts/generate/build.mjs
// Requer acesso de rede a query.wikidata.org e commons.wikimedia.org.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT = resolve(ROOT, 'src/data/items.json');
const CACHE = resolve(__dirname, '.cache');

const UA = 'QuantumQuiz/0.1 (https://github.com/; dev build) data-pipeline';
const SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const MIN_PER_MINIGAME = 2000; // PRD: fôlego para "nunca repetir" a 5/dia (~400 dias)

// Cada query -> como mapear os campos para o schema de item.
const QUERIES = [
  { file: 'cars_products.rq', category: 'produto', metric: null, metricType: null },
  { file: 'films.rq', category: 'filme', metric: 'boxoffice', metricType: 'bilheteria (US$)' },
  { file: 'cities.rq', category: 'cidade', metric: 'population', metricType: 'população' },
  { file: 'events.rq', category: 'evento', metric: null, metricType: null },
];

async function runSparql(query, cacheKey) {
  const cachePath = resolve(CACHE, `${cacheKey}.json`);
  if (existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  }
  const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`SPARQL ${cacheKey} falhou: ${res.status}`);
  const json = await res.json();
  await mkdir(CACHE, { recursive: true });
  await writeFile(cachePath, JSON.stringify(json));
  return json;
}

const val = (b, k) => (b[k] ? b[k].value : undefined);
const qid = (uri) => (uri ? uri.split('/').pop() : undefined);

function bindingToItem(b, q) {
  const item = {
    id: qid(val(b, 'item')),
    name: val(b, 'itemLabel'),
    year: val(b, 'year') ? parseInt(val(b, 'year'), 10) : undefined,
    image: val(b, 'image'),
    country: val(b, 'countryLabel'),
    countryCode: val(b, 'countryCode'),
    category: q.category,
  };
  if (q.metric && val(b, q.metric) != null) {
    item.metric = Number(val(b, q.metric));
    item.metricType = q.metricType;
  }
  return item;
}

// Licença e autor da imagem (obrigatório para CC-BY; PRD seção 9).
async function imageLicense(imageUrl) {
  const fname = decodeURIComponent(imageUrl.split('/').pop()).replace(/_/g, ' ');
  const params = new URLSearchParams({
    action: 'query',
    titles: `File:${fname}`,
    prop: 'imageinfo',
    iiprop: 'extmetadata',
    format: 'json',
    origin: '*',
  });
  try {
    const res = await fetch(`${COMMONS}?${params}`, { headers: { 'User-Agent': UA } });
    const json = await res.json();
    const pages = json.query?.pages || {};
    const page = Object.values(pages)[0];
    const meta = page?.imageinfo?.[0]?.extmetadata || {};
    return {
      license: meta.LicenseShortName?.value || 'desconhecida',
      author: (meta.Artist?.value || '—').replace(/<[^>]+>/g, '').trim(),
    };
  } catch {
    return { license: 'desconhecida', author: '—' };
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, seed) {
  const rng = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const REQUIRED = {
  whenLaunched: ['name', 'image', 'year'],
  higherLower: ['name', 'metric'],
  whichCountry: ['name', 'country'],
  guessImage: ['name', 'image'],
  timeline: ['name', 'year'],
};

async function main() {
  const all = new Map(); // dedupe por id

  for (const q of QUERIES) {
    const query = await readFile(resolve(__dirname, 'sparql', q.file), 'utf8');
    process.stdout.write(`→ ${q.file} … `);
    const json = await runSparql(query, q.file.replace('.rq', ''));
    const rows = json.results.bindings.map((b) => bindingToItem(b, q));
    let added = 0;
    for (const it of rows) {
      if (!it.id || !it.name) continue;
      if (!all.has(it.id)) {
        all.set(it.id, it);
        added++;
      }
    }
    console.log(`${rows.length} linhas, +${added} itens`);
  }

  let items = [...all.values()];

  // Enriquece licença/autor das imagens (em paralelo, com limite de conexões).
  const withImages = items.filter((it) => it.image);
  const CONCURRENCY = 10;
  console.log(`→ buscando licença de ${withImages.length} imagens no Commons (${CONCURRENCY} em paralelo)…`);
  let done = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < withImages.length) {
      const it = withImages[cursor++];
      const { license, author } = await imageLicense(it.image);
      it.license = license;
      it.author = author;
      if (++done % 100 === 0 || done === withImages.length) {
        process.stdout.write(`\r  ${done}/${withImages.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log('');

  items = shuffle(items, 0x9e3779b9);

  // Validação de fôlego (PRD seção 3).
  console.log('\nFôlego por minigame:');
  for (const [mg, fields] of Object.entries(REQUIRED)) {
    const n = items.filter((it) => fields.every((f) => it[f] != null && it[f] !== '')).length;
    const ok = n >= MIN_PER_MINIGAME ? 'OK' : `BAIXO (< ${MIN_PER_MINIGAME})`;
    console.log(`  ${mg.padEnd(14)} ${String(n).padStart(6)}  ${ok}`);
  }

  await writeFile(OUT, JSON.stringify(items));
  console.log(`\n✓ ${items.length} itens escritos em ${OUT}`);
  console.log('  (atualize src/data/index.js para importar items.json)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
