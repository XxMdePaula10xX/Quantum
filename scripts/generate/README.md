# Pipeline de geração da base (Wikidata → JSON)

Gera `src/data/items.json` (base única, embutida, offline) a partir do Wikidata
(CC0) com licenças de imagem do Wikimedia Commons. PRD §3.

## Uso

```bash
node scripts/generate/build.mjs      # ou: npm run data:build
```

Requer rede para `query.wikidata.org` e `commons.wikimedia.org`. Respostas
SPARQL são cacheadas em `scripts/generate/.cache/` (apague para re-buscar).

## Etapas

1. Roda cada query em `sparql/*.rq`.
2. Mapeia os resultados para o schema de item (`id, name, year, image, country,
   countryCode, metric, metricType, category`).
3. Para cada imagem, busca `license` e `author` no Commons (módulo `imageinfo`,
   `extmetadata`) — obrigatório para CC-BY (PRD §9).
4. Deduplica por `id`, embaralha (determinístico) e escreve `items.json`.
5. Reporta o **fôlego** por minigame (alvo ≥ 2.000 itens — PRD §3).

Depois de gerar, troque o import em `src/data/index.js` de `items.sample.json`
para `items.json`.

## Queries (`sparql/`)

| Arquivo | Conteúdo | Minigames |
|---|---|---|
| `cars_products.rq` | Carros/produtos com imagem, ano, país | QuandoLançou, De que país é, Adivinhe pela imagem |
| `films.rq` | Filmes com ano e bilheteria | Linha do tempo, QuandoLançou, Maior ou menor |
| `cities.rq` | Cidades com população, país, coordenadas | Maior ou menor, De que país é |
| `events.rq` | Eventos históricos com data | Linha do tempo |

Edite/teste as queries no [Wikidata Query Service](https://query.wikidata.org/).
Se um minigame ficar abaixo de 2.000 itens, amplie as `VALUES`/categorias da
query correspondente ou aceite repetição após X dias (PRD §3).

## Eventos do Kaggle (opcional)

O PRD sugere complementar a linha do tempo com o dataset "World Important
Events" (Kaggle). Para incorporar: baixe o CSV, normalize para o mesmo schema
(`name`, `year`, `category: 'evento'`) e concatene ao array antes de escrever
`items.json`.
