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
// Mesma base ATIVA do app: cliente e servidor importam o MESMO items.json,
// para que a reconstrução determinística do diário bata exatamente.
import items from '../src/data/items.json' assert { type: 'json' };

initializeApp();
const db = getFirestore();

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login obrigatório para o ranking.');
  return request.auth.uid;
}

// Converte exceções inesperadas em HttpsError COM mensagem (o Firebase esconde
// a mensagem de erros não-HttpsError, virando um "internal" opaco). Também loga
// o stack completo, que aparece em `firebase functions:log`.
function asHttps(e, hint) {
  if (e instanceof HttpsError) return e;
  console.error('submit error:', e && e.stack ? e.stack : e);
  return new HttpsError('internal', `${hint}: ${e && e.message ? e.message : e}`);
}

// Recalcula a pontuação total de uma sequência de rodadas + respostas.
function recompute(def, rounds, answers, format) {
  let combo = 0;
  let total = 0;
  const breakdown = [];
  rounds.forEach((round, i) => {
    const ans = answers[i] || {};
    // Detecta base do servidor diferente da do app (itemId enviado pelo cliente).
    if (ans.itemId && round.item && ans.itemId !== round.item.id) {
      throw new HttpsError(
        'failed-precondition',
        'A base do servidor está diferente do app. Rode "firebase deploy --only functions" depois de regenerar a base.'
      );
    }
    const res = resolveRound(def, round, ans, { combo, format });
    if (!Number.isFinite(res.points)) {
      throw new HttpsError('internal', `Pontuação inválida na rodada ${i + 1} (${def.id}).`);
    }
    combo = res.combo;
    total += res.points;
    breakdown.push(res.points);
  });
  return { total, breakdown };
}

// ---- Diário (totalmente defendido / determinístico) ------------------------
export const submitDailyScore = onCall(async (request) => {
  try {
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
  } catch (e) {
    throw asHttps(e, 'Falha ao enviar o diário');
  }
});

// ---- Contra o tempo (defendido via reconstrução por seed) ------------------
// O cliente envia, por rodada, { itemId, salt, input, timeRemaining, timeTotal }.
// O servidor rebuilda cada rodada com buildRoundFor(def, pool, item, salt) —
// determinístico — e recalcula com o bônus de tempo.
export const submitTimerScore = onCall(async (request) => {
  try {
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
      // salt do cliente = Math.floor(rnd*1e9). Usa o MESMO inteiro (sem truncar
      // p/ int32 como `| 0` faria), senão a reconstrução por seed divergiria.
      const salt = Number.isFinite(r.salt) ? Math.trunc(r.salt) : 0;
      const round = buildRoundFor(def, pool, item, salt);
      const res = resolveRound(def, round, r.input || {}, {
        combo,
        format: 'timer',
        timeRemaining: r.timeRemaining,
        timeTotal: r.timeTotal,
      });
      if (!Number.isFinite(res.points)) continue;
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
  } catch (e) {
    throw asHttps(e, 'Falha ao enviar a pontuação');
  }
});
