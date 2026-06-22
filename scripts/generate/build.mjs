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

// Quanto puxar. Ajuste por variável de ambiente:
//   PER_CHUNK   = LIMIT de cada fatia da query (default 8000)
//   MAX_PER_QUERY = teto de itens por query, p/ controlar tamanho (default 15000)
// Ex.: MAX_PER_QUERY=40000 PER_CHUNK=10000 npm run data:build
const PER_CHUNK = Number(process.env.PER_CHUNK || 8000);
const MAX_PER_QUERY = Number(process.env.MAX_PER_QUERY || 15000);
const NOW_YEAR = new Date().getFullYear();

// Gera faixas [min,max) de ano. Janelas menores nos períodos densos (moderno)
// e maiores na antiguidade (esparsa) — cada fatia fica abaixo do timeout do WDQS.
function yearWindows(from) {
  const w = [];
  const ancient = [[-3000, 0], [0, 1000], [1000, 1500], [1500, 1700], [1700, 1850], [1850, 1900]];
  for (const [a, b] of ancient) if (b > from) w.push([Math.max(a, from), b]);
  for (let y = Math.max(1900, from); y <= NOW_YEAR; y += 10) w.push([y, Math.min(y + 10, NOW_YEAR + 1)]);
  return w;
}

// Faixas de população (maior -> menor) para fatiar a query de cidades.
const POP_WINDOWS = [
  [5_000_000, 100_000_000],
  [1_000_000, 5_000_000],
  [500_000, 1_000_000],
  [200_000, 500_000],
  [100_000, 200_000],
  [50_000, 100_000],
];

// Cada query: como mapear campos + como fatiar (por ano ou por população).
const QUERIES = [
  { file: 'cars_products.rq', category: 'produto', chunkBy: 'year', from: 1850 },
  { file: 'films.rq', category: 'filme', metric: 'boxoffice', metricType: 'bilheteria (US$)', chunkBy: 'year', from: 1900 },
  { file: 'cities.rq', category: 'cidade', metric: 'population', metricType: 'população', chunkBy: 'population' },
  { file: 'events.rq', category: 'evento', chunkBy: 'year', from: -3000 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Executa SPARQL com cache, POST, timeout e retry com backoff. 504/429/5xx e
// timeouts são "transitórios": tenta de novo algumas vezes antes de desistir.
async function runSparql(query, cacheKey, attempt = 0) {
  const MAX_RETRIES = 4;
  const cachePath = resolve(CACHE, `${cacheKey}.json`);
  if (existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000); // 90s
  try {
    const res = await fetch(SPARQL, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ query }),
      signal: controller.signal,
    });
    if (res.status === 429 || res.status >= 500) {
      throw Object.assign(new Error(`HTTP ${res.status}`), { transient: true });
    }
    if (!res.ok) throw new Error(`SPARQL ${cacheKey} falhou: ${res.status}`);
    const json = await res.json();
    await mkdir(CACHE, { recursive: true });
    await writeFile(cachePath, JSON.stringify(json));
    return json;
  } catch (e) {
    const transient = e.transient || e.name === 'AbortError' || e.code === 'ECONNRESET';
    if (transient && attempt < MAX_RETRIES) {
      const wait = 5000 * 2 ** attempt; // 5s, 10s, 20s, 40s
      console.log(`   ${cacheKey}: ${e.message} — tentando de novo em ${wait / 1000}s (${attempt + 1}/${MAX_RETRIES})`);
      await sleep(wait);
      return runSparql(query, cacheKey, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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
  higherLower: ['name', 'metric', 'metricType'],
  whichCountry: ['name', 'country'],
  guessImage: ['name', 'image'],
  timeline: ['name', 'year'],
};

async function main() {
  const all = new Map(); // dedupe por id

  for (const q of QUERIES) {
    const template = await readFile(resolve(__dirname, 'sparql', q.file), 'utf8');
    const windows = q.chunkBy === 'population' ? POP_WINDOWS : yearWindows(q.from);
    const base = q.file.replace('.rq', '');
    console.log(`\n→ ${q.file} (${windows.length} fatias, teto ${MAX_PER_QUERY})`);

    let qCount = 0;
    for (const [min, max] of windows) {
      if (qCount >= MAX_PER_QUERY) break;
      const query = template
        .replaceAll('__MIN__', String(min))
        .replaceAll('__MAX__', String(max))
        .replaceAll('__LIMIT__', String(PER_CHUNK));
      let json;
      try {
        json = await runSparql(query, `${base}_${min}_${max}`);
      } catch (e) {
        console.log(`   fatia ${min}–${max}: ERRO (${e.message}) — pulando`);
        continue;
      }
      const rows = json.results.bindings.map((b) => bindingToItem(b, q));
      let added = 0;
      for (const it of rows) {
        if (!it.id || !it.name) continue;
        if (qCount >= MAX_PER_QUERY) break;
        if (!all.has(it.id)) {
          all.set(it.id, it);
          added++;
          qCount++;
        }
      }
      console.log(`   fatia ${min}–${max}: ${rows.length} linhas, +${added} (acum. ${qCount})`);
    }
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
  console.log('  O app e a Cloud Function já usam esse items.json automaticamente.');
}

// Saída limpa: setar exitCode em vez de process.exit() evita o crash de libuv
// no Windows quando ainda há handles assíncronos abertos.
main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((e) => {
    console.error('\nFalha:', e.message);
    process.exitCode = 1;
  });
