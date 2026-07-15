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
  // Recentes / Gen-Z:
  { file: 'games.rq', category: 'jogo', metric: 'units', metricType: 'cópias vendidas', chunkBy: 'year', from: 1970 },
  { file: 'consoles.rq', category: 'console', metric: 'units', metricType: 'unidades vendidas', chunkBy: 'year', from: 1972 },
  { file: 'phones.rq', category: 'celular', chunkBy: 'year', from: 1990 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Executa SPARQL com cache, POST, timeout e retry com backoff. 504/429/5xx e
// timeouts são "transitórios": tenta de novo algumas vezes antes de desistir.
// Hash curto do conteúdo da query: entra no nome do cache para que ALTERAR uma
// query invalide o cache antigo automaticamente (sem precisar apagar .cache/).
function queryHash(q) {
  let h = 5381;
  for (let i = 0; i < q.length; i++) h = ((h << 5) + h + q.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

async function runSparql(query, cacheKey, attempt = 0) {
  const MAX_RETRIES = 4;
  const cachePath = resolve(CACHE, `${cacheKey}.${queryHash(query)}.json`);
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
    // https obrigatório: iOS (ATS) e Android (targetSdk 36) bloqueiam http://
    image: val(b, 'image') ? val(b, 'image').replace(/^http:\/\//, 'https://') : undefined,
    country: val(b, 'countryLabel'),
    countryCode: val(b, 'countryCode'),
    category: q.category,
    // notoriedade (nº de Wikipédias) — usada para priorizar conhecimento geral
    fame: val(b, 'sitelinks') ? parseInt(val(b, 'sitelinks'), 10) : 0,
  };
  if (q.metric && val(b, q.metric) != null) {
    item.metric = Number(val(b, q.metric));
    item.metricType = q.metricType;
  }
  return item;
}

// Decide se uma licença é LIVRE para uso comercial (com ou sem atribuição):
// domínio público / CC0 / CC BY / CC BY-SA (+ GFDL / Free Art). Rejeita
// não-comercial (NC), sem-derivados (ND), copyright e "desconhecida".
function isFreeLicense(text) {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return false;
  // CC BY e CC BY-SA (a negativa exclui CC BY-NC e CC BY-ND)
  if (/cc[ -]?by(?![ -]?n)/.test(t)) return true;
  // domínio público / sem restrições
  if (/\bcc0\b|public domain|\bpdm\b|\bpd[- ]|no restrictions|sem restri/.test(t)) return true;
  // outras licenças livres comuns no Commons
  if (/gfdl|free art|\bfal\b/.test(t)) return true;
  return false;
}

// Nome do arquivo Commons ('File:...') a partir da URL de imagem (P18).
function fileTitle(imageUrl) {
  return 'File:' + decodeURIComponent(imageUrl.split('/').pop());
}

// Consulta em LOTE ao Commons (até 50 arquivos por requisição) — muito mais
// rápido e confiável que 1 requisição por imagem (evita throttle). POST + retry.
async function commonsBatch(titles, attempt = 0) {
  const params = new URLSearchParams({
    action: 'query',
    titles: titles.join('|'),
    prop: 'imageinfo',
    iiprop: 'extmetadata',
    redirects: '1',
    format: 'json',
    origin: '*',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(COMMONS, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: controller.signal,
    });
    if (res.status === 429 || res.status >= 500) {
      throw Object.assign(new Error(`HTTP ${res.status}`), { transient: true });
    }
    if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    const transient = e.transient || e.name === 'AbortError' || e.code === 'ECONNRESET';
    if (transient && attempt < 4) {
      await sleep(3000 * 2 ** attempt);
      return commonsBatch(titles, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Extrai licença/autor/free de uma "page" da resposta do Commons.
function licenseFromPage(page) {
  const meta = page?.imageinfo?.[0]?.extmetadata || {};
  const shortName = meta.LicenseShortName?.value || '';
  const machine = meta.License?.value || '';
  const free = meta.Copyrighted?.value === 'False' || isFreeLicense(`${machine} ${shortName}`);
  return {
    license: shortName || machine || 'desconhecida',
    author: (meta.Artist?.value || '—').replace(/<[^>]+>/g, '').trim(),
    free,
  };
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

  // Preflight: confirma que o endpoint responde antes de fatiar tudo.
  process.stdout.write('Testando conexão com o Wikidata… ');
  try {
    await runSparql('SELECT ?x WHERE { BIND(1 AS ?x) }', '_preflight');
    console.log('OK');
  } catch {
    console.log('FALHOU.');
    console.log(
      'O Wikidata não respondeu (504/timeout). O serviço público às vezes fica\n' +
        'sobrecarregado. Espere alguns minutos e rode de novo — o cache aproveita o\n' +
        'que já deu certo. (Status: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service)'
    );
    return;
  }

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

  // Enriquece licença/autor das imagens em LOTES de 50 (vários lotes em
  // paralelo). Casa cada "page" de volta ao item, seguindo normalizações e
  // redirecionamentos de título que o Commons aplica.
  const withImages = items.filter((it) => it.image);
  const BATCH = 50;
  const PARALLEL = 4;
  const batches = [];
  for (let i = 0; i < withImages.length; i += BATCH) batches.push(withImages.slice(i, i + BATCH));
  console.log(`→ licenças de ${withImages.length} imagens no Commons (${batches.length} lotes de ${BATCH})…`);

  let done = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const group = batches[cursor++];
      const titleToItems = new Map(); // título solicitado -> itens
      for (const it of group) {
        const t = fileTitle(it.image);
        if (!titleToItems.has(t)) titleToItems.set(t, []);
        titleToItems.get(t).push(it);
      }
      let data = null;
      try {
        data = await commonsBatch([...titleToItems.keys()]);
      } catch (e) {
        console.log(`\n   lote ${cursor}: ${e.message} — itens ficam sem licença`);
      }
      if (data?.query) {
        // mapa reverso título-final -> título-solicitado (normalização/redirect)
        const back = {};
        for (const n of data.query.normalized || []) back[n.to] = n.from;
        for (const r of data.query.redirects || []) back[r.to] = r.from;
        for (const page of Object.values(data.query.pages || {})) {
          let req = page.title;
          while (back[req]) req = back[req];
          const list = titleToItems.get(req) || titleToItems.get(page.title) || [];
          const info = licenseFromPage(page);
          for (const it of list) {
            it.license = info.license;
            it.author = info.author;
            it._free = info.free;
          }
        }
      }
      done += group.length;
      process.stdout.write(`\r  ${Math.min(done, withImages.length)}/${withImages.length}`);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  console.log('');

  // Filtro de licença (PRD seção 9): descarta imagens sem licença livre
  // confirmada. O ITEM permanece (pode servir minigames sem imagem), apenas a
  // imagem/licença/autor são removidas. Use ALLOW_NONFREE=1 para pular (debug).
  const allowNonFree = process.env.ALLOW_NONFREE === '1';
  let droppedImages = 0;
  for (const it of withImages) {
    if (!allowNonFree && !it._free) {
      delete it.image;
      delete it.license;
      delete it.author;
      droppedImages++;
    }
    delete it._free;
  }
  console.log(
    `→ filtro de licença: ${withImages.length - droppedImages} imagens livres mantidas, ` +
      `${droppedImages} descartadas${allowNonFree ? ' (IGNORADO: ALLOW_NONFREE=1)' : ''}.`
  );

  // Remove itens que, sem a imagem, não servem a NENHUM minigame.
  const qualifiesAny = (it) =>
    Object.values(REQUIRED).some((fields) => fields.every((f) => it[f] != null && it[f] !== ''));
  const before = items.length;
  items = items.filter(qualifiesAny);
  if (before !== items.length) console.log(`→ removidos ${before - items.length} itens sem uso após o filtro.`);

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

  // Separa a base por minigame para o app carregar sob demanda.
  console.log('\nSeparando por minigame…');
  const { split } = await import('./split.mjs');
  await split();
  console.log('  O app e a Cloud Function já usam esses dados automaticamente.');
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
