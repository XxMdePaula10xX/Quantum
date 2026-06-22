# Quantum 🔵🔍

App de **quiz casual** de estimativa e dedução. Partidas curtas (segundos a 2
min), 5 minigames sobre uma **base de dados única** do Wikidata (CC0), com 3
formatos de jogo e ranking validado no servidor.

> Implementação do MVP descrito no PRD (v1.0). Stack: **Vite + React (JS)**,
> **Firebase** (Auth + Firestore + Cloud Functions), base gerada por **SPARQL**.

---

## Começando

```bash
npm install
npm run dev          # http://localhost:5173 — joga offline, sem Firebase
npm test             # roda os testes do motor (pontuação, diário, minigames)
npm run build        # build de produção (dist/)
```

O app **funciona offline** com a base de exemplo (`src/data/items.sample.json`).
Login e ranking global são opcionais e exigem Firebase (veja abaixo).

---

## Minigames (PRD §2)

| Minigame | Faz | Pontuação |
|---|---|---|
| 📅 QuandoLançou | Vê a imagem, chuta o ano | Proximidade |
| ⚖️ Maior ou menor | Escolhe o número maior | Binário + combo |
| 🌍 De que país é | Adivinha o país (busca em lista) | Binário |
| 🖼️ Adivinhe pela imagem | Imagem revela aos poucos, adivinha o nome | Proximidade (revelação) |
| ⏳ Linha do tempo | Ordena por ano | Ordenação por pares |

Todos compartilham **um único motor** (`src/engine`) e **um registro**
(`src/minigames/registry.js`). Adicionar minigame = adicionar uma entrada lá.

## Formatos (PRD §5)

- **Diário** — 5 rodadas/dia, determinístico por data (todos jogam os mesmos
  itens, sem repetição), 1 envio/dia. Conta para o ranking diário.
- **Infinito** — ilimitado e aleatório, sem timer. Recorde local, fora do ranking.
- **Contra o tempo** — tempo é bônus sobre o acerto. Ranking separado.

## Pontuação (PRD §6)

Matemática fixa e determinística em `src/engine/scoring.js` (teto de 1000/rodada
antes de combo/tempo). As **mesmas funções** rodam no cliente e no servidor.
Cobertas por testes (`npm test`).

---

## Arquitetura

```
src/
  engine/        scoring · rng · dailyQueue · session · share   (lógica pura, testada)
  minigames/     registry.js (regras) + components/views.jsx (UI)
  formats/       useGameSession.js (hook dos 3 formatos)
  data/          items.sample.json + loader (base única)
  state/         storage.js (localStorage: recordes, dias jogados)
  firebase/      config · auth · scores (tudo opcional/guardado)
  screens/       Menu · Game · Result · Ranking · Login · Sources
functions/       Cloud Functions: submitDailyScore / submitTimerScore (defendido)
firestore.rules  score só gravável via Admin SDK (cliente nunca escreve score)
scripts/generate SPARQL + pipeline da base (Wikidata + Commons)
```

---

## Firebase (opcional — login e ranking) — PRD §7

1. Crie um projeto no Firebase (Auth: e-mail/senha; Firestore).
2. `cp .env.example .env` e preencha as chaves `VITE_FIREBASE_*`.
3. Deploy das regras e funções:
   ```bash
   cd functions && npm install && cd ..
   firebase deploy --only firestore:rules,functions
   ```

**Anti-trapaça (defendido):** o cliente envia as *respostas*, não a pontuação.
A Cloud Function reconstrói as rodadas de forma determinística e **recalcula**
com as mesmas fórmulas, gravando só o valor validado. As Security Rules impedem
o cliente de escrever score diretamente.

---

## Base de dados (PRD §3)

A base ATIVA é sempre `src/data/items.json` (cliente **e** Cloud Function
importam o mesmo arquivo). Inicialmente é uma cópia da base de exemplo. Para
trocar pela base real:

```bash
npm run data:build   # roda SPARQL no Wikidata + licenças no Commons
```

O script **sobrescreve** `src/data/items.json` com os dados do Wikidata e
reporta o "fôlego" por minigame (alvo: ≥ 2.000 itens cada — ver
`scripts/generate/README.md`). **Não precisa editar mais nada** — o app passa a
usar a base real automaticamente.

---

## Licenças (PRD §9)

- Dados: Wikidata (CC0). Imagens: Commons (domínio público ou CC-BY/CC-BY-SA).
- O pipeline guarda `license` e `author` por imagem; a tela **Fontes** exibe os
  créditos (obrigatório para CC-BY).
- A base de exemplo usa imagens **placeholder** marcadas como tal — sem
  atribuição falsa.

## Publicação (PRD §8, Sprint 4)

`npm run build` gera `dist/`. Publique via Firebase Hosting (`firebase deploy
--only hosting`) ou empacote para as lojas via Codemagic (mesmo fluxo do PRD).

---

## Decisões adotadas (PRD §11)

1. Ranking **defendido** (Cloud Function) desde o início — código pronto.
2. Primeiro minigame: **QuandoLançou** (mas os 5 já estão implementados).
3. Nome: **Quantum** (provisório).
4. Dias anteriores: **só diversão** (não alimentam ranking histórico).
