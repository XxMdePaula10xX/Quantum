// Cloud Functions — validação de pontuação do ranking (PRD seção 7).
//
// Princípio anti-trapaça (nível "defendido"): o cliente envia as RESPOSTAS,
// não a pontuação. O servidor RECONSTRÓI as mesmas rodadas (de forma
// determinística) e RECALCULA a pontuação com as MESMAS funções do cliente
// (src/engine), gravando no Firestore apenas o valor recalculado.
//
// A reutilização do código do cliente (importado abaixo) garante "mesma
// fórmula" sem duplicação. O build (esbuild) empacota esses módulos.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { getMinigame } from '../src/minigames/registry.js';
import { makeDailyRounds, resolveRound, buildRoundFor } from '../src/engine/session.js';
import { itemsForMinigame } from '../src/minigames/registry.js';
import items from '../src/data/items.sample.json' assert { type: 'json' };

initializeApp();
const db = getFirestore();

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login obrigatório para o ranking.');
  return request.auth.uid;
}

// Recalcula a pontuação total de uma sequência de rodadas + respostas.
function recompute(def, rounds, answers, format) {
  let combo = 0;
  let total = 0;
  const breakdown = [];
  rounds.forEach((round, i) => {
    const res = resolveRound(def, round, answers[i] || {}, { combo, format });
    combo = res.combo;
    total += res.points;
    breakdown.push(res.points);
  });
  return { total, breakdown };
}

// ---- Diário (totalmente defendido / determinístico) ------------------------
export const submitDailyScore = onCall(async (request) => {
  const uid = requireAuth(request);
  const { minigameId, date, answers } = request.data || {};
  if (!minigameId || !date || !Array.isArray(answers)) {
    throw new HttpsError('invalid-argument', 'Payload inválido.');
  }
  const def = getMinigame(minigameId);

  // 1 envio por dia por minigame.
  const ref = db.doc(`dailyScores/${date}/${minigameId}/${uid}`);
  if ((await ref.get()).exists) {
    throw new HttpsError('already-exists', 'Você já enviou o diário de hoje.');
  }

  // Reconstrói as MESMAS 5 rodadas determinísticas da data.
  const rounds = makeDailyRounds(def, items, date);
  if (answers.length !== rounds.length) {
    throw new HttpsError('invalid-argument', 'Número de respostas incompatível.');
  }

  const { total, breakdown } = recompute(def, rounds, answers, 'daily');
  await ref.set({
    score: total,
    breakdown,
    displayName: request.auth.token.name || null,
    submittedAt: FieldValue.serverTimestamp(),
  });
  return { score: total, breakdown };
});

// ---- Contra o tempo (defendido via reconstrução por seed) ------------------
// O cliente envia, por rodada, { itemId, salt, input, timeRemaining, timeTotal }.
// O servidor rebuilda cada rodada com buildRoundFor(def, pool, item, salt) —
// determinístico — e recalcula com o bônus de tempo.
export const submitTimerScore = onCall(async (request) => {
  const uid = requireAuth(request);
  const { minigameId, rounds: clientRounds } = request.data || {};
  if (!minigameId || !Array.isArray(clientRounds)) {
    throw new HttpsError('invalid-argument', 'Payload inválido.');
  }
  const def = getMinigame(minigameId);
  const pool = itemsForMinigame(items, def);
  const byId = new Map(pool.map((it) => [it.id, it]));

  let combo = 0;
  let total = 0;
  for (const r of clientRounds) {
    const item = byId.get(r.itemId);
    if (!item) continue; // item desconhecido => ignorado (não pontua)
    const round = buildRoundFor(def, pool, item, r.salt | 0);
    const res = resolveRound(def, round, r.input || {}, {
      combo,
      format: 'timer',
      timeRemaining: r.timeRemaining,
      timeTotal: r.timeTotal,
    });
    combo = res.combo;
    total += res.points;
  }

  const ref = db.doc(`timerScores/${minigameId}/scores/${uid}`);
  const prev = await ref.get();
  const best = Math.max(total, prev.exists ? prev.data().bestScore || 0 : 0);
  await ref.set(
    {
      bestScore: best,
      displayName: request.auth.token.name || null,
      achievedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { score: total, bestScore: best };
});
