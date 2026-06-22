# Pipeline de geração da base (Wikidata → JSON)

Gera `src/data/items.json` (base única, embutida, offline) a partir do Wikidata
(CC0) com licenças de imagem do Wikimedia Commons. PRD §3.

## Uso

```bash
node scripts/generate/build.mjs      # ou: npm run data:build
```

Requer rede para `query.wikidata.org` e `commons.wikimedia.org`. Respostas
SPARQL são cacheadas em `scripts/generate/.cache/` (apague para re-buscar).

### Quanto puxar (quantos itens)

As queries são **fatiadas** (por faixa de ano ou de população) para não estourar
o timeout de 60s do Wikidata e poder puxar dezenas de milhares de itens. Ajuste
o volume por variáveis de ambiente:

| Variável | Default | O que faz |
|---|---|---|
| `MAX_PER_QUERY` | `15000` | teto de itens por categoria (controla o tamanho do app) |
| `PER_CHUNK` | `8000` | `LIMIT` de cada fatia |

```bash
# puxar bem mais (ex.: ~40 mil por categoria)
MAX_PER_QUERY=40000 PER_CHUNK=10000 npm run data:build      # macOS/Linux
```
No Windows (PowerShell):
```powershell
$env:MAX_PER_QUERY=40000; $env:PER_CHUNK=10000; npm run data:build
```

> Referência de tamanho: ~2 mil itens ≈ 0,5 MB embutidos; ~20 mil ≈ alguns MB.
> Acima de ~20 mil por categoria, considere separar a base por minigame.

## Etapas

1. Roda cada query em `sparql/*.rq`.
2. Mapeia os resultados para o schema de item (`id, name, year, image, country,
   countryCode, metric, metricType, category`).
3. Para cada imagem, busca `license` e `author` no Commons (módulo `imageinfo`,
   `extmetadata`) — obrigatório para CC-BY (PRD §9).
4. **Filtro de licença**: descarta imagens sem licença livre confirmada
   (mantém domínio público / CC0 / CC BY / CC BY-SA / GFDL; rejeita NC, ND,
   copyright e `desconhecida`). O item continua na base (pode servir minigames
   sem imagem); só a imagem/licença/autor são removidas. Itens que ficam sem
   nenhum uso são descartados. Para pular o filtro (debug): `ALLOW_NONFREE=1`.
5. Deduplica por `id`, embaralha (determinístico) e escreve `items.json`.
6. Reporta o **fôlego** por minigame (alvo ≥ 2.000 itens — PRD §3).

> Após o filtro, os minigames com imagem (QuandoLançou, Adivinhe pela imagem)
> podem encolher — é esperado e legalmente necessário. Se algum ficar `BAIXO`,
> amplie a query correspondente.

O script **sobrescreve** `src/data/items.json` (a base ATIVA do app). Não é
preciso editar mais nada: app e Cloud Function já importam esse arquivo. Para
voltar à base de exemplo, copie `items.sample.json` por cima de `items.json`.

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
